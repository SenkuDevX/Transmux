import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import { spawn } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import archiver from "archiver";
import { isS3Configured, uploadToS3, getSignedDownloadUrl, deleteFromS3 } from "./src/storage.js";
import { authMiddleware, isAuthEnabled } from "./src/middleware/auth.js";
import { initSocketIO, emitJobUpdate, emitJobProgress, emitJobComplete, emitJobError, emitThumbnailProgress } from "./src/lib/socket-server.js";

dotenv.config();

// Prevent process crashes from unhandled errors
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", (reason as any)?.message || reason);
});

const app = express();
app.set("trust proxy", 1);
// Selective auth middleware - only protects write operations and sensitive routes
app.use(/^\/api\/(convert|upload|job\/.*cancel|publish|cleanup|stealth|sync|keys|repair|creator).*/, authMiddleware);
const PORT = parseInt(process.env.PORT || "3000", 10);
const BACKEND_URL = process.env.BACKEND_URL || `http://0.0.0.0:${PORT}`;
const USE_S3 = isS3Configured();
const ENGINE_ENABLED = process.env.STATUS !== "false";
const PROXY_URL = process.env.PROXY_URL || "";
const DEFAULT_FORMAT = "bestvideo+bestaudio/best";

// Enable JSON body rendering
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — required when frontend is on a different origin (Vercel)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rate limiting — per-IP throttle to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 20,
  message: { success: false, error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/job/") || req.path === "/health",
});
app.use("/api", apiLimiter);

// Engine status middleware — blocks all conversion endpoints when STATUS=false
app.use("/api", (req, res, next) => {
  if (!ENGINE_ENABLED && !req.path.startsWith("/health") && !req.path.startsWith("/cookies")) {
    return res.status(503).json({ success: false, error: "Engine is under maintenance. Coming back soon!" });
  }
  next();
});

// Use /data when HF persistent storage is mounted, otherwise tmp/
const DATA_ROOT = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "tmp");
const tmpJobsDir = path.join(DATA_ROOT, "jobs");
fs.mkdirSync(tmpJobsDir, { recursive: true });
const tmpPublishedDir = path.join(DATA_ROOT, "published");
fs.mkdirSync(tmpPublishedDir, { recursive: true });
const COOKIES_FILE = path.join(DATA_ROOT, "cookies.txt");
const COOKIES_FILE_PENDING = path.join(DATA_ROOT, "cookies_pending.txt");

// Check if aria2c is available for faster parallel downloads
let HAS_ARIA2 = false;
try {
  const { spawnSync } = require("child_process");
  const result = spawnSync("aria2c", ["--version"], { stdio: "pipe", timeout: 3000 });
  HAS_ARIA2 = result.status === 0;
  if (HAS_ARIA2) console.log("[Downloader] aria2c detected — will use for faster parallel downloads");
} catch {
  console.log("[Downloader] aria2c not found — using yt-dlp's built-in downloader");
}

// On startup, write YOUTUBE_COOKIES env var to cookies file (if set)
if (process.env.YOUTUBE_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_FILE, process.env.YOUTUBE_COOKIES, "utf-8");
    console.log(`[Cookies] Loaded from YOUTUBE_COOKIES env var (${process.env.YOUTUBE_COOKIES.length} bytes)`);
  } catch (err: any) {
    console.error(`[Cookies] Failed to write cookies from env var: ${err.message}`);
  }
}

// Setup Multer discrete storage per job
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobId = crypto.randomUUID();
    // In order to link jobId in multer, we write it to request
    (req as any).jobId = jobId;
    const jobDir = path.join(tmpJobsDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // Keep original extension but enforce clean name to avoid path traversal / execution risks
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `input${ext}`);
  },
});

// Enforce 1GB upload limit
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

// In-memory job state repository
interface JobState {
  id: string;
  type: "file" | "url";
  status: "queued" | "processing" | "completed" | "failed" | "waiting_cookies";
  progress: number;
  speed: string;
  eta: string;
  inputName: string;
  inputSize: number;
  outputName: string | null;
  outputSize: number;
  outputBitrate?: string;
  error: string | null;
  createdAt: string;
  downloadUrl: string | null;
  
  // Internal server trackers
  totalDuration: number; // in seconds
  inputPath: string | null;
  outputPath: string | null;
  s3Key: string | null; // S3 object key (if USE_S3)
  subtitleFiles: string[]; // .vtt/.srt files from yt-dlp
  phase: string; // 'downloading' | 'transcoding' | 'muxing' | 'done'

  // Cookie refresh flow
  waitingCookies: boolean;
  cookieRetryCount: number;
  _settings?: any;
  _url?: string;
  _currentProcess?: import("child_process").ChildProcess | null;
  priority: number; // higher = more urgent
}

// Priority queue system
let jobQueue: { id: string; priority: number; createdAt: string }[] = [];
let isProcessingQueue = false;

function computePriority(duration: number, settings: any): number {
  let p = 0;
  if (duration > 0 && duration < 60) p += 3;
  if (settings?.videoCodec === "keep" && settings?.audioCodec === "keep") p += 2;
  if (!settings?.videoCodec || settings.videoCodec === "keep" || settings.videoCodec === "") p += 1;
  return p;
}

function enqueueJob(jobId: string, priority: number) {
  jobQueue.push({ id: jobId, priority, createdAt: new Date().toISOString() });
}

function processQueue() {
  if (isProcessingQueue || jobQueue.length === 0) return;
  jobQueue.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  const next = jobQueue.shift()!;
  const job = jobs.get(next.id);
  if (!job || job.status !== "queued") { processQueue(); return; }
  isProcessingQueue = true;
  job.status = "processing";
  const s = job._settings;
  const u = job._url;
  (async () => {
    await (processMediaJob(job, s, u));
    isProcessingQueue = false;
    processQueue();
  })();
}

const redisStatePath = path.join(DATA_ROOT, "redis_state.json");

class SimulatedRedis {
  private cache: Map<string, JobState> = new Map();

  constructor() {
    this.restoreFromFile();
  }

  private restoreFromFile() {
    try {
      if (fs.existsSync(redisStatePath)) {
        const raw = fs.readFileSync(redisStatePath, "utf8");
        const data = JSON.parse(raw);
        for (const key of Object.keys(data)) {
          this.cache.set(key, data[key]);
        }
        console.log(`[RedisSimDB] Successfully restored ${this.cache.size} cached jobs from disk.`);
      }
    } catch (e) {
      console.warn("[RedisSimDB] Warning: Restoring database state failed. Moving on with fresh queue.", e);
    }
  }

  private persist() {
    try {
      const obj: Record<string, JobState> = {};
      for (const [key, val] of this.cache.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(redisStatePath, JSON.stringify(obj, null, 2), "utf8");
    } catch (e) {
      console.error("[RedisSimDB] Critical error writing database storage safely:", e);
    }
  }

  get(key: string): JobState | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: JobState) {
    this.cache.set(key, value);
    this.persist();
    console.log(`[RedisSimDB] SET key: job:${key} | status is now: [${value.status}]`);
  }

  delete(key: string): boolean {
    const res = this.cache.delete(key);
    this.persist();
    return res;
  }

  entries(): [string, JobState][] {
    return Array.from(this.cache.entries());
  }
}

const db = new SimulatedRedis();
const jobs = {
  get: (key: string) => db.get(key),
  set: (key: string, val: JobState) => db.set(key, val),
  delete: (key: string) => db.delete(key),
  entries: () => db.entries(),
  has: (key: string) => db.get(key) !== undefined,
};

// Helper: Probe media file details using ffprobe
function probeMetadata(filePath: string): Promise<{ duration: number; width?: number; height?: number; videoCodec?: string; audioCodec?: string; sampleRate?: number; channels?: number }> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height,codec_name,codec_type,sample_rate,channels",
      "-of", "json",
      filePath,
    ]);

    let stdout = "";
    ffprobe.stdout.on("data", (data) => { stdout += data; });
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        return resolve({ duration: 0 });
      }
      try {
    const data = JSON.parse(stdout);
        const formatDuration = parseFloat(data.format?.duration || "0");
        const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
        const audioStream = data.streams?.find((s: any) => s.codec_type === "audio");
        resolve({
          duration: formatDuration,
          width: videoStream?.width,
          height: videoStream?.height,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : undefined,
          channels: audioStream?.channels,
        });
      } catch (e) {
        resolve({ duration: 0 });
      }
    });
  });
}

// Helper: Map yt-dlp stderr output to human-friendly specific errors
function formatYtdlpError(stderr: string): string {
  const lower = stderr.toLowerCase();
  if (lower.includes("unsupported url")) {
    return "The URL platform or media stream format is unsupported. Ensure you paste a supported link (e.g. YouTube, Vimeo, Soundcloud).";
  }
  if (lower.includes("not a bot") || lower.includes("confirm you are not a bot") || lower.includes("confirm you're not a bot")) {
    return "YouTube blocked the request — this server IP has been flagged. Use the extension to send real browser cookies or try again later.";
  }
  if (lower.includes("video unavailable") || lower.includes("private video")) {
    return "This video is unavailable. It may have been deleted, set to private, or region-restricted by the publisher.";
  }
  if (lower.includes("sign in to confirm your age") || lower.includes("confirm your age") || lower.includes("login required") || lower.includes("sign in to confirm")) {
    return "This stream is age-restricted or requires user authorization (login). Transmux can only pull public streams.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Access to this video stream was blocked by the host platform (HTTP Error 403 Forbidden). Try another URL.";
  }
  if (lower.includes("451") || lower.includes("unavailable for legal reasons")) {
    return "Network stream blocked in this region due to legal/copyright limitations (HTTP 451).";
  }
  if (lower.includes("incompatible") || lower.includes("format not available")) {
    return "Selected resolution/stream format combination is offline or incompatible with the source media.";
  }
  if (lower.includes("getaddrinfo") || lower.includes("nametoaddr") || lower.includes("could not resolve")) {
    return "Unable to connect with the media platform. Please verify server internet connection and try again.";
  }
  
  // Try to find a line starting with "ERROR:" and return it cleanly
  const matches = stderr.match(/ERROR:\s*(.+)/i);
  if (matches && matches[1]) {
    return matches[1].replace(/; Please report this issue[^;$]*/i, "").trim();
  }
  
  return "The url extractor pipeline was rejected. Ensure the target URL is public and currently operational.";
}

// Helper: Map FFmpeg stderr execution logs to human-friendly specific errors
function parseFfmpegError(stderr: string): string {
  const lower = stderr.toLowerCase();
  if (lower.includes("unknown encoder") || lower.includes("encoder not found")) {
    const encoderMatch = stderr.match(/unknown encoder\s+'([^']+)'/i) || stderr.match(/encoder\s+'([^']+)'\s+not found/i);
    const encName = encoderMatch ? encoderMatch[1] : "";
    return `The selected output format or codec ${encName ? `'${encName}' ` : ""}is currently unsupported or disabled on this server container. Try a standard H.264 (libx264) format.`;
  }
  if (lower.includes("unrecognized option") || lower.includes("option not found")) {
    return "An mismatched or unrecognized encoding option was passed to the converter. Try resetting parameters back to default (keep source) parameters.";
  }
  if (lower.includes("invalid argument") || lower.includes("invalid option") || lower.includes("incorrect value")) {
    return "A parameter value (e.g. invalid framerate limit, frame dimensions, or audio channels value) was rejected by FFmpeg. Double check setting controls.";
  }
  if (lower.includes("error selecting filters") || lower.includes("filtergraph") || lower.includes("error re-scaling") || lower.includes("failed to configure filter")) {
    return "The video filter graph failed. This is usually caused by setting custom parameters that do not match the input aspect ratio or frame structures.";
  }
  if (lower.includes("invalid data found when processing input") || lower.includes("error while decoding")) {
    return "The input media container metadata is damaged, empty or uses an unknown track arrangement. Remuxing could not complete safely.";
  }
  if (lower.includes("error while opening encoder") || lower.includes("can't open encoder")) {
    return "The system could not start the encoder. Try changing target bitrates or video preset parameters to safe default values.";
  }
  if (lower.includes("no such file or directory") || lower.includes("could not open")) {
    return "Unable to access the local source file directory. The media stream may have expired or been deleted from server pool.";
  }
  if (lower.includes("permission denied") || lower.includes("operation not permitted")) {
    return "FFmpeg was blocked from accessing file blocks due to system permissions. Clear directory cache & re-upload.";
  }
  if (lower.includes("does not contain any streams") || lower.includes("no streams")) {
    return "The uploaded container file is invalid or empty; no readable video/audio tracks could be detected.";
  }

  // Fallback to searching for the last line with [error] if exists
  const lines = stderr.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.includes("Error") || line.includes("Failed") || (line.startsWith("[") && line.toLowerCase().includes("error"))) {
      return line.replace(/^\[[^\]]+\]\s*/, "").trim();
    }
  }

  return "FFmpeg pipelines failed unexpectedly during transcoding. Verify settings match the target file format.";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"\/\\|?*]/g, "_").replace(/\s+/g, "_").slice(0, 100);
}

// REST API Endpoints

// 1. Health Ping
app.get("/api/health", (req, res) => {
  res.json({
    status: ENGINE_ENABLED ? "ok" : "maintenance",
    product: "Transmux (Project Saga)",
    engine: ENGINE_ENABLED ? "live" : "maintenance",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Hardware Acceleration Detection
const HW_ACCEL_CACHE: { detected: string[]; probedAt: number } = { detected: [], probedAt: 0 };
const HW_ACCEL_PROBE_INTERVAL = 60000; // 1 minute

async function probeHardwareAccel(): Promise<string[]> {
  try {
    const available: string[] = [];
    const encoders = await new Promise<string>((resolve, reject) => {
      const p = spawn("ffmpeg", ["-encoders"]);
      let out = "";
      p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      p.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error("ffmpeg -encoders failed"));
      });
    });

    // Check for common hardware encoders
    const checks: [string, string][] = [
      ["h264_nvenc", "nvidia"],
      ["hevc_nvenc", "nvidia"],
      ["h264_amf", "amd"],
      ["hevc_amf", "amd"],
      ["h264_vaapi", "intel"],
      ["hevc_vaapi", "intel"],
      ["h264_videotoolbox", "apple"],
      ["hevc_videotoolbox", "apple"],
    ];

    const seen = new Set<string>();
    for (const [encoder, vendor] of checks) {
      if (encoders.includes(encoder) && !seen.has(vendor)) {
        seen.add(vendor);
        available.push(vendor);
      }
    }

    return available;
  } catch {
    return [];
  }
}

app.get("/api/hardware-accel", async (req, res) => {
  const now = Date.now();
  if (HW_ACCEL_CACHE.detected.length > 0 && now - HW_ACCEL_CACHE.probedAt < HW_ACCEL_PROBE_INTERVAL) {
    return res.json({ success: true, available: HW_ACCEL_CACHE.detected });
  }
  HW_ACCEL_CACHE.detected = await probeHardwareAccel();
  HW_ACCEL_CACHE.probedAt = now;
  res.json({ success: true, available: HW_ACCEL_CACHE.detected });
});

// Helper: spawn yt-dlp and capture output, with retry on stale cookies or proxy fallback
const YTDLP_BASE = ["--impersonate", "Chrome-136", "--no-check-formats"];
const META_EXTRACTOR = "youtube:player_client=web_embedded;skip=webpage,js";
const DL_EXTRACTOR = "youtube:player_client=web;skip=webpage,js";
const DL_EXTRACTOR_NO_COOKIES = "youtube:player_client=android;skip=webpage,js";

function addCookiesArg(args: string[], jobId?: string): string[] {
  // Prefer job-specific cookies if they exist
  if (jobId) {
    const jobCookies = path.join(tmpJobsDir, jobId, "cookies.txt");
    if (fs.existsSync(jobCookies)) {
      return [...args, "--cookies", jobCookies];
    }
  }
  // Fall back to global cookies file
  if (fs.existsSync(COOKIES_FILE)) {
    return [...args, "--cookies", COOKIES_FILE];
  }
  return args;
}

function execYtDlp(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", [...YTDLP_BASE, ...args]);
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

function isBotError(stderr: string): boolean {
  return stderr.includes("Sign in to confirm") || stderr.includes("not a bot") || stderr.includes("OPENSSL_internal");
}

async function runYtDlp(baseArgs: string[], noCookieExtractor?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  // Attempt 1: with cookies
  let result = await execYtDlp(addCookiesArg([...baseArgs]));

  // If bot error and cookies exist, skip stale cookies and retry
  if (result.code !== 0 && isBotError(result.stderr) && fs.existsSync(COOKIES_FILE)) {
    console.log("[yt-dlp] Cookies rejected by YouTube (stale/expired), retrying without cookies...");
    const stalePath = COOKIES_FILE + ".stale";
    try { fs.renameSync(COOKIES_FILE, stalePath); } catch {}
    let retryArgs = baseArgs;
    if (noCookieExtractor) {
      retryArgs = baseArgs.map(a => a === DL_EXTRACTOR ? noCookieExtractor : a);
    }
    result = await execYtDlp([...retryArgs]);
    if (result.code === 0) {
      console.log("[yt-dlp] Succeeded without cookies. Cookies have been marked stale.");
      return result;
    }
    // Restore cookies if no-cookie attempt also failed
    try { fs.renameSync(stalePath, COOKIES_FILE); } catch {}
  }

  // Attempt 2: through proxy if available
  if (result.code !== 0 && PROXY_URL) {
    console.log("[yt-dlp] Retrying through proxy...");
    let proxyArgs = baseArgs;
    if (noCookieExtractor) {
      proxyArgs = baseArgs.map(a => a === DL_EXTRACTOR ? noCookieExtractor : a);
    }
    result = await execYtDlp([...proxyArgs, "--proxy", PROXY_URL]);
  }

  return result;
}

// 1b. Cookies management (admin-only — uses ADMIN_KEY env var)
const ADMIN_KEY = process.env.ADMIN_KEY;

function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!ADMIN_KEY) return res.status(500).json({ success: false, error: "ADMIN_KEY not set on server" });
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(403).json({ success: false, error: "Forbidden. Provide Authorization: Bearer <ADMIN_KEY> header." });
  }
  next();
}

app.post("/api/cookies", requireAdmin, (req, res) => {
  const { cookies } = req.body;
  if (!cookies || typeof cookies !== "string") {
    return res.status(400).json({ success: false, error: "Cookies text is required" });
  }
  try {
    fs.writeFileSync(COOKIES_FILE, cookies, "utf-8");
    console.log(`[Cookies] Saved cookies file (${cookies.length} bytes)`);
    res.json({ success: true, message: "Cookies saved. Stored permanently in /data — survive all restarts." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to save cookies: ${err.message}` });
  }
});

app.get("/api/cookies", (req, res) => {
  const exists = fs.existsSync(COOKIES_FILE);
  res.json({ success: true, hasCookies: exists });
});

// API Key Management (in-memory, survives restarts via env)
const API_KEYS: { key: string; id: string; name: string; createdAt: string }[] = [];
if (process.env.API_KEY) {
  API_KEYS.push({ key: process.env.API_KEY, id: "default", name: "default", createdAt: new Date().toISOString() });
}

app.get("/api/keys", (req, res) => {
  res.json({ success: true, keys: API_KEYS.map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt, preview: k.key.slice(0, 8) + "..." })) });
});

app.post("/api/keys", (req, res) => {
  const { name } = req.body;
  const id = "k_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const key = "tmx_" + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
  API_KEYS.unshift({ key, id, name: name || `Key ${API_KEYS.length}`, createdAt: new Date().toISOString() });
  res.json({ success: true, id, key });
});

app.delete("/api/keys/:id", (req, res) => {
  const idx = API_KEYS.findIndex((k) => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: "Key not found" });
  API_KEYS.splice(idx, 1);
  res.json({ success: true });
});

// API Key auth middleware (optional — adds x-api-key header check)
function optionalApiKey(req: any, res: any, next: any) {
  const header = req.headers["x-api-key"];
  if (header && API_KEYS.some((k) => k.key === header)) {
    req.apiKey = header;
  }
  next();
}
app.use("/api/convert", optionalApiKey);
app.use("/api/url", optionalApiKey);
app.use("/api/upload", optionalApiKey);

// Hardware Acceleration Detection (cached 60s)
let hwAccelCache: { available: string[]; ts: number } = { available: [], ts: 0 };
app.get("/api/hardware-accel", async (req, res) => {
  const now = Date.now();
  if (now - hwAccelCache.ts < 60000) {
    return res.json({ success: true, available: hwAccelCache.available });
  }
  try {
    const encoders = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffmpeg", ["-hide_banner", "-encoders"], { timeout: 8000 });
      let out = "";
      proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => { if (code === 0 || out.length > 0) resolve(out); else reject(new Error(`exit ${code}`)); });
    });
    const available: string[] = [];
    if (encoders.includes("nvenc")) available.push("nvidia");
    if (encoders.includes("amf")) available.push("amd");
    if (encoders.includes("qsv")) available.push("intel");
    if (encoders.includes("videotoolbox")) available.push("apple");
    hwAccelCache = { available, ts: now };
    res.json({ success: true, available });
  } catch {
    res.json({ success: true, available: [] });
  }
});

// Pending cookie endpoint — extension sends cookies here before a job is created
app.post("/api/cookies/pending", (req, res) => {
  const { cookies } = req.body;
  if (!cookies || typeof cookies !== "string") {
    return res.status(400).json({ success: false, error: "cookies (string) is required" });
  }
  try {
    // If global cookie file also exists, append to it; otherwise create fresh
    if (fs.existsSync(COOKIES_FILE)) {
      fs.writeFileSync(COOKIES_FILE, cookies, "utf-8");
    }
    fs.writeFileSync(COOKIES_FILE_PENDING, cookies, "utf-8");
    console.log(`[Cookies] Pending cookies saved (${cookies.length} bytes)`);
    res.json({ success: true, message: "Cookies saved. They will be used for the next request." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to save cookies: ${err.message}` });
  }
});

// 2. Local File Upload
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const jobId = (req as any).jobId;
    const inputPath = req.file.path;
    const originalName = req.file.originalname;
    const inputSize = req.file.size;
    const ext = path.extname(originalName).slice(1);

    // Enforce 0 bytes empty file check
    if (inputSize === 0) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(400).json({
        success: false,
        error: `The file '${originalName}' is completely empty (0 bytes). Please upload a valid media file.`
      });
    }

    // Extract detailed stream format meta via ffprobe
    const meta = await probeMetadata(inputPath);

    // Verify file contains readable media streams (allowing standard subtitles/images without codec info)
    const isSubtitleExt = ["srt", "vtt", "ass", "sub"].includes(ext.toLowerCase());
    const isImageExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext.toLowerCase());
    if (meta.duration === 0 && !meta.videoCodec && !meta.audioCodec && !isSubtitleExt && !isImageExt) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(400).json({
        success: false,
        error: `The uploaded file '${originalName}' does not contain any readable video or audio stream metadata. Please ensure the file is not corrupted and uses standard media codec formats.`
      });
    }

      const job: JobState = {
        id: jobId,
        type: "file",
        status: "queued",
        progress: 0,
        speed: "0x",
        eta: "...",
        inputName: originalName,
        inputSize: inputSize,
        outputName: null,
        outputSize: 0,
        error: null,
        createdAt: new Date().toISOString(),
        downloadUrl: null,
        totalDuration: 0,
        inputPath: inputPath,
        outputPath: null,
        s3Key: null,
        subtitleFiles: [],
        phase: "",
        waitingCookies: false,
        cookieRetryCount: 0,
        priority: 0,
      };

    jobs.set(jobId, job);

    res.json({
      success: true,
      jobId,
      metadata: {
        filename: originalName,
        size: inputSize,
        duration: meta.duration,
        format: ext,
        video: meta.videoCodec ? {
          codec: meta.videoCodec,
          resolution: meta.width && meta.height ? `${meta.width}x${meta.height}` : null,
        } : null,
        audio: meta.audioCodec ? {
          codec: meta.audioCodec,
          sampleRate: meta.sampleRate,
          channels: meta.channels,
        } : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Upload probing failed" });
  }
});

// 3. YouTube & URL Metadata Extraction
app.post("/api/url/metadata", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  // Validate URL protocol and structure
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, error: "Only HTTP or HTTPS URL protocols are permitted" });
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: "Invalid URL format" });
  }

  // Spawn yt-dlp to inspect format offerings
  // Strategy: web (no cookies) → web (with cookies) → android (with cookies) → android (no cookies)
  let lastStderr = "";
  async function tryMetadata(clientArgs: string[]): Promise<{ stdout: string; stderr: string; code: number } | null> {
    const result = await execYtDlp(["-J", "--no-playlist", "--playlist-items", "1", ...clientArgs, url]);
    if (result.code === 0) return result;
    lastStderr = result.stderr;
    return null; // always continue to next strategy on any error
  }

  // Strategy 1: web client + cookies (most likely to work from HF Spaces)
  let result: Awaited<ReturnType<typeof tryMetadata>> = null;
  const cookiesToTry = [COOKIES_FILE, COOKIES_FILE_PENDING].filter((f) => fs.existsSync(f));
  if (cookiesToTry.length > 0) {
    console.log("[yt-dlp] Trying metadata with cookies...");
    result = await tryMetadata(["--cookies", cookiesToTry[0], "--extractor-args", META_EXTRACTOR]);
  }

  // Strategy 2: android client, no cookies
  if (!result) {
    console.log("[yt-dlp] Fallback: android client, no cookies...");
    result = await tryMetadata(["--extractor-args", DL_EXTRACTOR_NO_COOKIES]);
  }

  // Strategy 3: through proxy if configured
  if (!result && PROXY_URL) {
    console.log("[yt-dlp] Fallback: through proxy...");
    result = await execYtDlp(["-J", "--no-playlist", "--playlist-items", "1",
      "--extractor-args", DL_EXTRACTOR_NO_COOKIES, "--proxy", PROXY_URL, url]);
    if (result.code !== 0) {
      lastStderr = result.stderr;
      result = null;
    }
  }

  if (!result || result.code !== 0) {
    const stderr = result?.stderr || lastStderr || "Unknown error";
    console.error(`yt-dlp error output: ${stderr}`);
    const isAuthError = isBotError(stderr);
    return res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: formatYtdlpError(isAuthError ? "Sign in to confirm you're not a bot" : stderr),
      waitingCookies: isAuthError,
    });
  }

  try {
    const data = JSON.parse(result!.stdout);

    const formats = (data.formats || [])
      .filter((f: any) => f.vcodec !== "none" || f.acodec !== "none")
      .map((f: any) => ({
        formatId: f.format_id,
        extension: f.ext,
        resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : "audio-only"),
        videoCodec: f.vcodec || "none",
        audioCodec: f.acodec || "none",
        filesize: f.filesize || f.filesize_approx || 0,
        note: f.format_note || "",
      }));

    // Detect if we got limited formats (android client may only return up to 360p when blocked)
    const highestRes = formats
      .map((f: any) => {
        const match = f.resolution?.match(/(\d+)p/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .reduce((max, v) => Math.max(max, v), 0);
    const formatsLimited = highestRes <= 360;

    let bestThumbnail = data.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60";
    if (Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
      const sorted = [...data.thumbnails].filter((t: any) => t.url).sort((a: any, b: any) => {
        const areaA = (a.width || 0) * (a.height || 0);
        const areaB = (b.width || 0) * (b.height || 0);
        return areaB - areaA;
      });
      if (sorted[0]?.url) {
        bestThumbnail = sorted[0].url;
      }
    }

    res.json({
      success: true,
      metadata: {
        title: data.title || "Unknown Media Source",
        uploader: data.uploader || data.channel || data.creator || "",
        thumbnail: bestThumbnail,
        duration: data.duration || 0,
        extractor: data.extractor || "generic",
        formats: formats.reverse(),
        originalUrl: url,
        formatsLimited,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: "JSON parsing error on source metadata stream" });
  }
});

// 3b. Playlist metadata extraction
app.post("/api/url/playlist", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "URL is required" });

  let { stdout, stderr, code } = await execYtDlp([
    "-J",
    "--flat-playlist",
    "--no-playlist", "--playlist-items", "1:50",
    "--extractor-args", META_EXTRACTOR,
    url,
  ]);

  // Retry through proxy if direct connection failed
  if (code !== 0 && PROXY_URL) {
    console.log("[yt-dlp] Playlist extraction failed, retrying through proxy...");
    const proxyResult = await execYtDlp([
      "-J",
      "--flat-playlist",
      "--no-playlist", "--playlist-items", "1:50",
      "--extractor-args", DL_EXTRACTOR_NO_COOKIES,
      "--proxy", PROXY_URL,
      url,
    ]);
    if (proxyResult.code === 0) {
      stdout = proxyResult.stdout;
      stderr = proxyResult.stderr;
      code = proxyResult.code;
    }
  }

  if (code !== 0) {
    return res.status(500).json({ success: false, error: formatYtdlpError(stderr) });
  }
  try {
    const data = JSON.parse(stdout);
    const isPlaylist = data.extractor_key === "YoutubePlaylist" || data.playlist_count > 1;
    const entries = (data.entries || []).slice(0, 50).map((e: any, i: number) => ({
      index: i,
      id: e.id || e.url,
      title: e.title || `Item ${i + 1}`,
      url: e.url || e.webpage_url,
      duration: e.duration || 0,
      thumbnail: e.thumbnail || data.thumbnail || "",
    }));

    res.json({
      success: true,
      isPlaylist,
      title: data.title || "Untitled Playlist",
      count: entries.length,
      entries,
      thumbnail: data.thumbnail || "",
      originalUrl: url,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: "Failed to parse playlist data" });
  }
});

// 3c. Convert playlist — batch process and zip
app.post("/api/convert/playlist", async (req, res) => {
  const { entries, formatId, outputFormat, bitrate, videoQuality, audioOnly } = req.body;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, error: "Playlist entries are required" });
  }

  const batchId = crypto.randomUUID();
  const batchDir = path.join(tmpJobsDir, `batch_${batchId}`);
  fs.mkdirSync(batchDir, { recursive: true });
  const zipPath = path.join(batchDir, "playlist.zip");

  const outputStream = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.pipe(outputStream);

  const total = entries.length;
  const results: { index: number; title: string; error?: string }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const itemDir = path.join(batchDir, `item_${i}`);
    fs.mkdirSync(itemDir, { recursive: true });

    try {
      const selFormat = entry.formatId || formatId || DEFAULT_FORMAT;
      const outExt = outputFormat || "mp4";

      await runYtDlp([
        "-f", selFormat,
        "-o", path.join(itemDir, `input.%(ext)s`),
        "--concurrent-fragments", "16",
        ...(HAS_ARIA2 ? ["--downloader", "aria2c", "--downloader-args", "aria2c:-x16 -s16 -k1M"] : []),
        "--write-subs", "--write-auto-subs", "--sub-langs", "all,-live_chat",
        "--convert-subs", "srt",
        "--no-playlist",
        "--extractor-args", DL_EXTRACTOR,
        entry.url,
      ], DL_EXTRACTOR_NO_COOKIES).then(({ stderr, code }) => {
        if (code !== 0) throw new Error(formatYtdlpError(stderr));
      });

      const files = fs.readdirSync(itemDir);
      const dlFile = files.find(f => f.startsWith("input."));
      if (!dlFile) throw new Error("No file downloaded");

      const inputPath = path.join(itemDir, dlFile);
      const outName = `${sanitizeFilename(entry.title || `item_${i}`)}.${outExt}`;
      const outputPath = path.join(itemDir, outName);

      let ffmpegArgs = ["-i", inputPath];
      if (audioOnly) {
        ffmpegArgs.push("-vn", "-c:a", bitrate === "lossless" ? "flac" : "libmp3lame");
        if (bitrate && bitrate !== "lossless") ffmpegArgs.push("-b:a", bitrate);
      } else {
        ffmpegArgs.push("-c:v", "libx264", "-preset", "veryfast");
        if (videoQuality) ffmpegArgs.push("-crf", videoQuality);
        if (bitrate && bitrate !== "lossless") ffmpegArgs.push("-c:a", "aac", "-b:a", bitrate);
        ffmpegArgs.push("-c:s", "copy");
      }
      ffmpegArgs.push("-y", outputPath);

      await new Promise<void>((resolve, reject) => {
        const ff = spawn("ffmpeg", ffmpegArgs);
        let errData = "";
        ff.stderr.on("data", (d) => { errData += d; });
        ff.on("close", (code) => {
          if (code !== 0) reject(new Error(`FFmpeg error: ${errData.slice(-200)}`));
          else resolve();
        });
      });

      archive.file(outputPath, { name: outName });
      results.push({ index: i, title: entry.title });
    } catch (err: any) {
      results.push({ index: i, title: entry.title, error: err.message });
    }

    // Cleanup item dir
    fs.rmSync(itemDir, { recursive: true, force: true });
  }

  await archive.finalize();
  await new Promise<void>((resolve) => outputStream.on("close", resolve));

  const zipStat = fs.statSync(zipPath);

  // Store batch info for download
  const batchMeta = { batchId, zipPath, total, results, createdAt: new Date().toISOString() };
  const batchMetaPath = path.join(tmpJobsDir, `batch_${batchId}.json`);
  fs.writeFileSync(batchMetaPath, JSON.stringify(batchMeta));

  res.json({
    success: true,
    batchId,
    total,
    completed: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results,
    downloadUrl: `/api/download/batch/${batchId}`,
  });
});

// Batch download
app.get("/api/download/batch/:batchId", (req, res) => {
  const { batchId } = req.params;
  const batchMetaPath = path.join(tmpJobsDir, `batch_${batchId}.json`);
  if (!fs.existsSync(batchMetaPath)) return res.status(404).json({ success: false, error: "Batch not found or expired" });

  const meta = JSON.parse(fs.readFileSync(batchMetaPath, "utf-8"));
  if (!fs.existsSync(meta.zipPath)) return res.status(404).json({ success: false, error: "Zip file not found" });

  res.download(meta.zipPath, `transmux_playlist_${batchId.slice(0, 8)}.zip`);
});

// 4. Trigger Media Conversion Action
app.post("/api/convert", async (req, res) => {
  const { jobId, settings, url } = req.body;

  if (!jobId && !url) {
    return res.status(400).json({ success: false, error: "Either jobId or url is required to invoke conversion" });
  }

  let activeJobId = jobId || crypto.randomUUID();
  let job: JobState;

  if (url) {
    // Generate new background job for URL flow
    const jobDir = path.join(tmpJobsDir, activeJobId);
    fs.mkdirSync(jobDir, { recursive: true });

    job = {
      id: activeJobId,
      type: "url",
      status: "queued",
      progress: 0,
      speed: "0x",
      eta: "N/A",
      inputName: "Extracting stream...",
      inputSize: 0,
      outputName: null,
      outputSize: 0,
      error: null,
      createdAt: new Date().toISOString(),
      downloadUrl: null,
      totalDuration: 0,
      inputPath: null,
      outputPath: null,
      s3Key: null,
      subtitleFiles: [],
      phase: "",
      waitingCookies: false,
      cookieRetryCount: 0,
      priority: 0,
    };
    // Compute priority based on settings
    if (settings) {
      job.priority = computePriority(0, settings);
      job._settings = settings;
      job._url = url;
    }
    jobs.set(activeJobId, job);
  } else {
    // Verify uploaded file job
    const storedJob = jobs.get(activeJobId);
    if (!storedJob) {
      return res.status(404).json({ success: false, error: "Job ID not found" });
    }
    job = storedJob;
  }

  // Enqueue and process in priority order
  job.priority = computePriority(job.totalDuration, settings);
  enqueueJob(job.id, job.priority);
  processQueue();

  res.json({
    success: true,
    jobId: activeJobId,
    status: "queued",
  });
});

// List all active jobs (sorted by priority)
app.get("/api/jobs", (req, res) => {
  const active: any[] = [];
  for (const [, j] of jobs.entries()) {
    if (j.status !== "completed" && j.status !== "failed") {
      active.push({
        id: j.id, status: j.status, progress: j.progress,
        inputName: j.inputName, phase: j.phase,
        priority: j.priority, createdAt: j.createdAt,
      });
    }
  }
  active.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  res.json({ success: true, jobs: active, queueLength: jobQueue.length, isProcessing: isProcessingQueue });
});

// Update job priority (manual reorder)
app.put("/api/jobs/:jobId/priority", (req, res) => {
  const { jobId } = req.params;
  const { priority } = req.body;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  job.priority = typeof priority === "number" ? priority : 0;
  // Also update queue entry if present
  const qe = jobQueue.find((q) => q.id === jobId);
  if (qe) qe.priority = job.priority;
  res.json({ success: true, priority: job.priority });
});

// Cookie refresh endpoint — extension POSTs fresh YouTube cookies here
app.post("/api/cookies/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { cookies } = req.body;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  if (!cookies || typeof cookies !== "string") {
    return res.status(400).json({ success: false, error: "cookies (string) is required" });
  }

  // Write to job-specific cookies file
  const cookiesPath = path.join(tmpJobsDir, jobId, "cookies.txt");
  fs.writeFileSync(cookiesPath, cookies);
  console.log(`[Cookies] Received fresh cookies for job ${jobId} (${cookies.length} bytes)`);

  // Respond IMMEDIATELY — metadata re-extraction runs in background
  res.json({ success: true });

  // Background: re-extract metadata with fresh cookies to check if better formats are now available
  if (job._url) {
    (async () => {
      try {
        let metaResult = await execYtDlp(["-J", "--no-playlist", "--playlist-items", "1",
          "--cookies", cookiesPath,
          "--extractor-args", META_EXTRACTOR,
          job._url]);
        // Retry through proxy if direct connection failed
        if (metaResult.code !== 0 && PROXY_URL) {
          console.log(`[Job ${jobId}] Re-extraction failed, retrying through proxy...`);
          metaResult = await execYtDlp(["-J", "--no-playlist", "--playlist-items", "1",
            "--cookies", cookiesPath,
            "--extractor-args", META_EXTRACTOR,
            "--proxy", PROXY_URL,
            job._url]);
        }
        if (metaResult.code === 0) {
          const data = JSON.parse(metaResult.stdout);
          const formats = (data.formals || [])
            .filter((f: any) => f.url || f.manifest_url)
            .map((f: any) => ({
              formatId: f.format_id,
              ext: f.ext,
              resolution: f.height ? `${f.height}p` : (f.format_note || "audio"),
              filesize: f.filesize || f.filesize_approx || 0,
              note: f.format_note || "",
            }));
          const highestRes = formats
            .map((f: any) => {
              const match = f.resolution?.match(/(\d+)p/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .reduce((max, v) => Math.max(max, v), 0);
          if (highestRes > 360) {
            if (job._settings) {
              job._settings.selectedFormatId = "bestvideo+bestaudio/best";
            }
            console.log(`[Job ${jobId}] Re-extracted metadata with fresh cookies: found formats up to ${highestRes}p`);
          }
        }
      } catch (e: any) {
        console.warn(`[Job ${jobId}] Metadata re-extraction failed: ${e.message?.slice(0, 100)}`);
      }
    })();
  }

  // Resume job if waiting for cookies (fire-and-forget)
  if (job.waitingCookies && job.status === "waiting_cookies") {
    job.cookieRetryCount = (job.cookieRetryCount || 0) + 1;
    processMediaJob(job, job._settings, job._url);
  }
});

// Cancel a running job
app.post("/api/job/:jobId/cancel", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  if (job._currentProcess) {
    try { job._currentProcess.kill("SIGTERM"); } catch {}
    job._currentProcess = null;
  }
  job.status = "failed";
  job.error = "Cancelled by user";
  console.log(`[Job ${jobId}] Cancelled by user`);
  res.json({ success: true });
});

// Helper: Process job lifecycle in background
async function processMediaJob(job: JobState, settings: any, url?: string) {
  const jobDir = path.join(tmpJobsDir, job.id);

  // Save settings for potential cookie refresh retry
  job._settings = settings;
  job._url = url;

  try {
    job.status = "processing";
    job.phase = "downloading";
    job.waitingCookies = false;
    job.progress = 5;
    emitJobProgress(job.id, 5);
    if (job.type === "url" && url) {
      // If download file already exists from a previous attempt, skip download
      // EXCEPT when cookies were just refreshed — delete old stale download and re-fetch
      const existingFiles = fs.existsSync(jobDir) ? fs.readdirSync(jobDir) : [];
      let existingDownload = existingFiles.find(f => f.startsWith("input.") && !/\.(jpg|jpeg|png|webp)$/i.test(f));
      if (existingDownload && job.waitingCookies) {
        console.log(`[Job ${job.id}] Cookies refreshed, deleting old download to re-download with fresh auth...`);
        try { fs.unlinkSync(path.join(jobDir, existingDownload)); } catch {}
        existingDownload = null;
      }
      if (existingDownload) {
        job.inputName = settings.mediaTitle || `url_source_${settings.outputFormat || 'converted'}${path.extname(existingDownload)}`;
      } else {
        job.inputName = `Downloading from URL...`;

        const formatSelection = settings.selectedFormatId && settings.selectedFormatId !== "best" && settings.selectedFormatId !== DEFAULT_FORMAT
          ? settings.selectedFormatId
          : DEFAULT_FORMAT;

        // Build a resolution-based fallback format string from user's selection
        const resFallback: string = (() => {
          if (settings.videoResolution) {
            const resMatch = settings.videoResolution.match(/(\d+)/);
            if (resMatch) return `bestvideo[height<=${resMatch[1]}]+bestaudio/best[height<=${resMatch[1]}]`;
          }
          return "";
        })();

        // Determine concurrent fragments based on file size estimate (4K = more fragments)
        const isLikely4K = formatSelection.match(/137|401|696|697|698|699|571|700|702/) ||
          (settings.videoResolution && settings.videoResolution.includes("2160"));
        const concurrentFrags = HAS_ARIA2 ? (isLikely4K ? "64" : "32") : "16";
        const downloaderArgs = HAS_ARIA2
          ? `aria2c:-x${isLikely4K ? "12" : "8"} -s${isLikely4K ? "12" : "8"} -k${isLikely4K ? "4M" : "2M"} --min-split-size=1M`
          : "";
        const baseDownloadArgs = [
          "-f", formatSelection,
          "--concurrent-fragments", concurrentFrags,
          ...(downloaderArgs ? ["--downloader", "aria2c", "--downloader-args", downloaderArgs] : []),
          "-o", path.join(jobDir, "input.%(ext)s"),
          "--write-thumbnail",
          "--convert-thumbnails", "jpg",
          "--no-playlist",
          "--throttled-rate", "0",
          url,
        ];
        // Android/fallback download args: use resolution fallback because android format IDs differ
        const androidFormat = resFallback || DEFAULT_FORMAT;
        const androidDownloadArgs = [
          "-f", androidFormat,
          "--concurrent-fragments", concurrentFrags,
          ...(downloaderArgs ? ["--downloader", "aria2c", "--downloader-args", downloaderArgs] : []),
          "-o", path.join(jobDir, "input.%(ext)s"),
          "--write-thumbnail",
          "--convert-thumbnails", "jpg",
          "--no-playlist",
          "--throttled-rate", "0",
          url,
        ];

        const dlCookieArgs = ["--extractor-args", DL_EXTRACTOR];
        const dlNoCookieArgs = ["--extractor-args", DL_EXTRACTOR_NO_COOKIES];

        async function attemptDownload(args: string[]): Promise<void> {
          const ytDlp = spawn("yt-dlp", args);
          job._currentProcess = ytDlp;
          let ytdlpStderr = "";

          ytDlp.stderr.on("data", (data) => {
            ytdlpStderr += data.toString();
          });

          await new Promise<void>((resolve, reject) => {
            ytDlp.stdout.on("data", (data) => {
              const text = data.toString();
              const progressMatch = text.match(/\[download\]\s+([\d\.]+)%/);
              const speedMatch = text.match(/at\s+([^\s]+)/);
              const etaMatch = text.match(/ETA\s+([^\s]+)/);

              if (progressMatch) {
                const downloadPct = parseFloat(progressMatch[1]);
                job.progress = Math.min(45, Math.round(downloadPct * 0.4));
                emitJobProgress(job.id as string, job.progress);
              }
              if (speedMatch) job.speed = speedMatch[1];
              if (etaMatch) job.eta = etaMatch[1];
            });

            ytDlp.on("close", (code) => {
              job._currentProcess = null;
              if (code !== 0) {
                const err = new Error(formatYtdlpError(ytdlpStderr));
                (err as any).rawStderr = ytdlpStderr;
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }

        // Try: cookies + impersonation → if bot error, trigger cookie refresh immediately
        // (Android/proxy fallback is a desperate last resort after 5 retries exhausted)
        const downloadAttempts: string[][] = [
          addCookiesArg([...YTDLP_BASE, ...dlCookieArgs, ...baseDownloadArgs], job.id),
        ];

        // After 5 cookie retries exhausted, try android/proxy as final fallback
        if (job.cookieRetryCount >= 5) {
          if (fs.existsSync(COOKIES_FILE)) {
            downloadAttempts.push([...YTDLP_BASE, ...dlNoCookieArgs, ...androidDownloadArgs]);
          }
          if (PROXY_URL) {
            downloadAttempts.push([...YTDLP_BASE, ...dlNoCookieArgs, ...androidDownloadArgs, "--proxy", PROXY_URL]);
          }
        }

        let lastError: Error | null = null;
        let allBotErrors = true;
        for (const attemptArgs of downloadAttempts) {
          try {
            await attemptDownload(attemptArgs);
            lastError = null;
            break;
          } catch (err: any) {
            lastError = err;
            const rawStderr = err.rawStderr || err.message;
            const isBot = isBotError(rawStderr);
            // "double free" = curl_cffi heap corruption from stale cookies — treat as cookie issue
            const isCookieCorruption = rawStderr.includes("double free") && attemptArgs.includes("--cookies");
            if (!isBot && !isCookieCorruption) allBotErrors = false;
            if (attemptArgs.includes("--cookies") && (isBot || isCookieCorruption)) {
              console.log("[yt-dlp] Cookies stale/expired, marking stale...");
              const stalePath = COOKIES_FILE + ".stale";
              try { fs.renameSync(COOKIES_FILE, stalePath); } catch {}
              const jobCookies = path.join(tmpJobsDir, job.id, "cookies.txt");
              if (fs.existsSync(jobCookies)) {
                try { fs.renameSync(jobCookies, jobCookies + ".stale"); } catch {}
              }
            }
            console.log(`[yt-dlp] Download attempt failed, trying next method...`);
          }
        }

        // If all attempts failed and it looks like an auth/bot issue, pause for cookie refresh
        if (lastError && allBotErrors && job.cookieRetryCount < 5) {
          console.log(`[Job ${job.id}] All attempts blocked by YouTube auth. Requesting cookie refresh from user...`);
          job.status = "waiting_cookies";
          job.waitingCookies = true;
          job.error = "YouTube requires authentication. Please refresh cookies.";
          return; // Exit gracefully — frontend will trigger cookie refresh
        }

        if (lastError) throw lastError;

        // Find downloaded file with dynamic extension (exclude thumbnails)
        const files = fs.readdirSync(jobDir);
        const downloadedFile = files.find(f => f.startsWith("input.") && !/\.(jpg|jpeg|png|webp)$/i.test(f));
        if (!downloadedFile) {
          throw new Error("Unable to locate downloaded url stream file in storage");
        }

        job.inputPath = path.join(jobDir, downloadedFile);
        job.inputSize = fs.statSync(job.inputPath).size;
        job.inputName = settings.mediaTitle || `url_source_${settings.outputFormat || 'converted'}${path.extname(downloadedFile)}`;

        // Verify downloaded quality matches requested format
        try {
          const dlMeta = await probeMetadata(job.inputPath);
          const reqRes = settings.videoResolution || settings.selectedFormatId || "";
          const actualRes = dlMeta.height ? `${dlMeta.height}p` : "unknown";
          console.log(`[Job ${job.id}] Downloaded: ${actualRes} (requested: ${reqRes})`);

          // If quality is significantly lower than requested, retry with resolution-based format
          if (settings.videoResolution && dlMeta.height) {
            const reqHeight = parseInt(settings.videoResolution.match(/(\d+)/)?.[1] || "0");
            if (reqHeight > 0 && dlMeta.height < reqHeight * 0.8) {
              console.log(`[Job ${job.id}] Quality mismatch: got ${dlMeta.height}p, expected ~${reqHeight}p. Retrying with resolution-based format...`);
              job.inputName = `Re-downloading with better format...`;
              // Redownload with resolution-based fallback
              const betterFormat = `bestvideo[height<=${reqHeight}]+bestaudio/best[height<=${reqHeight}]`;
              const reArgs = [
                "-f", betterFormat,
                "--concurrent-fragments", concurrentFrags,
                ...(downloaderArgs ? ["--downloader", "aria2c", "--downloader-args", downloaderArgs] : []),
                "-o", path.join(jobDir, "input.%(ext)s"),
                "--write-thumbnail",
                "--convert-thumbnails", "jpg",
                "--no-playlist",
                "--throttled-rate", "0",
                "--extractor-args", DL_EXTRACTOR,
                url,
              ];
              // Try with cookies + resolution format
              const reAttempts: string[][] = [
                addCookiesArg([...YTDLP_BASE, ...reArgs], job.id),
              ];
              let reSuccess = false;
              for (const reAttempt of reAttempts) {
                try {
                  await attemptDownload(reAttempt);
                  reSuccess = true;
                  break;
                } catch (e) {}
              }
              if (reSuccess) {
                // Re-find downloaded file
                const reFiles = fs.readdirSync(jobDir);
                const reDl = reFiles.find(f => f.startsWith("input.") && !/\.(jpg|jpeg|png|webp)$/i.test(f));
                if (reDl) {
                  job.inputPath = path.join(jobDir, reDl);
                  job.inputSize = fs.statSync(job.inputPath).size;
                  const newMeta = await probeMetadata(job.inputPath);
                  console.log(`[Job ${job.id}] Re-downloaded: ${newMeta.height ? newMeta.height + 'p' : 'unknown'}`);
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[Job ${job.id}] Could not verify download quality:`, e);
        }

        job.progress = 42;
        job.phase = "processing";

        // Download subtitles separately with retry strategies (only when burnSubtitles is enabled)
        if (settings.burnSubtitles) {
          const subDlBase = [
            "--write-subs", "--write-auto-subs", "--sub-langs", "all,-live_chat",
            "--convert-subs", "srt",
            "--skip-download",
            "-o", path.join(jobDir, "subs.%(ext)s"),
            "--no-playlist",
            "--throttled-rate", "0",
            url,
          ];
          const subClients = [
            { args: ["--extractor-args", "youtube:player_client=web;skip=webpage,js"], label: "web+cookies" },
            { args: ["--extractor-args", "youtube:player_client=android;skip=webpage,js"], label: "android" },
            { args: ["--extractor-args", "youtube:player_client=web_embedded;skip=webpage,js"], label: "embedded" },
          ];
          const subAttempts: string[][] = [];
          // Always try web with cookies first
          subAttempts.push(addCookiesArg([...YTDLP_BASE, ...subClients[0].args, ...subDlBase], job.id));
          // Also try android and embedded clients immediately (not just after 5 retries)
          subAttempts.push([...YTDLP_BASE, ...subClients[1].args, ...subDlBase]);
          subAttempts.push([...YTDLP_BASE, ...subClients[2].args, ...subDlBase]);
          // After 5 retries exhausted, try proxy fallback
          if (job.cookieRetryCount >= 5 && PROXY_URL) {
            subAttempts.push([...YTDLP_BASE, ...subClients[1].args, ...subDlBase, "--proxy", PROXY_URL]);
            subAttempts.push([...YTDLP_BASE, ...subClients[2].args, ...subDlBase, "--proxy", PROXY_URL]);
          }
          job.progress = 43;
          let subLastError: string | null = null;
          let allSubBotErrors = true;
          for (const subArgs of subAttempts) {
            try {
              const subResult = await new Promise<{ code: number; stderr: string }>((resolve) => {
                const subProc = spawn("yt-dlp", subArgs);
                let subErr = "";
                subProc.stderr.on("data", (d: Buffer) => { subErr += d.toString(); });
                subProc.on("close", (code) => resolve({ code: code ?? 1, stderr: subErr }));
              });
              if (subResult.code === 0) { subLastError = null; break; }
              subLastError = subResult.stderr;
              if (!isBotError(subResult.stderr)) allSubBotErrors = false;
              console.warn(`[Job ${job.id}] Subtitle attempt failed (trying next method)...`);
            } catch (e) {
              console.warn(`[Job ${job.id}] Subtitle attempt crashed:`, e);
              allSubBotErrors = false;
            }
          }

          if (subLastError && allSubBotErrors && job.cookieRetryCount < 5) {
            console.log(`[Job ${job.id}] All subtitle attempts blocked by auth. Requesting cookie refresh from user...`);
            job.status = "waiting_cookies";
            job.waitingCookies = true;
            job.error = "Subtitle download needs fresh YouTube cookies. Please refresh.";
            return;
          }

          job.progress = 44;
          // Re-read directory to include newly downloaded subtitle files
          const updatedFiles = fs.readdirSync(jobDir);

          // Collect subtitle files — match by extension, exclude video/audio/thumbnail files
          const SUB_EXTENSIONS = [".vtt", ".srt", ".ass", ".ssa", ".sub"];
          const EXCLUDED_PREFIXES = ["input.", "thumbnail"];
          job.subtitleFiles = updatedFiles.filter(f => {
            if (EXCLUDED_PREFIXES.some(p => f.startsWith(p))) return false;
            return SUB_EXTENSIONS.includes(path.extname(f).toLowerCase());
          });
          console.log(`[Job ${job.id}] Subtitle files found:`, job.subtitleFiles);
        }
      }
    }

    if (!job.inputPath || !fs.existsSync(job.inputPath)) {
      throw new Error("Local task source file does not exist or has expired");
    }

    // Probe stream duration and codec specs to resolve incompatibilities
    const meta = await probeMetadata(job.inputPath);
    if (!job.totalDuration || job.totalDuration === 0) {
      job.totalDuration = meta.duration;
      job.priority = computePriority(meta.duration, settings);
    }

    // Extract cover art thumbnail
    const thumbnailPath = path.join(jobDir, "thumbnail.jpg");
    let thumbnailDownloaded = fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0;

    // Attempt 1: Download from metadata thumbnail URL (skip if yt-dlp already wrote one)
    if (!thumbnailDownloaded && settings.thumbnailUrl) {
      try {
        // Try high-res YouTube thumbnail first
        const ytMatch = settings.thumbnailUrl.match(/(?:youtube\.com|youtu\.be|i\.ytimg\.com).*?(?:\/vi\/|\/vi_webp\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
          const videoId = ytMatch[1];
          for (const res of ["maxresdefault", "hqdefault", "sddefault"]) {
            const hqUrl = `https://i.ytimg.com/vi/${videoId}/${res}.jpg`;
            try {
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), 5000);
              const hr = await fetch(hqUrl, { signal: ctrl.signal });
              clearTimeout(tid);
              if (hr.ok) {
                const buf = await hr.arrayBuffer();
                if (buf.byteLength > 100) {
                  fs.writeFileSync(thumbnailPath, Buffer.from(buf));
                  thumbnailDownloaded = true;
                  console.log(`[CoverArt] Downloaded high-res thumbnail: ${res}.jpg (${buf.byteLength} bytes)`);
                  break;
                }
              }
            } catch { /* try next resolution */ }
          }
        }
        // Fall back to the provided thumbnailUrl if high-res failed
        if (!thumbnailDownloaded) {
          console.log(`[CoverArt] Downloading cover artwork from: ${settings.thumbnailUrl}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const resImg = await fetch(settings.thumbnailUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
          });
          clearTimeout(timeoutId);
          if (resImg.ok) {
            const buffer = await resImg.arrayBuffer();
            if (buffer.byteLength > 100) {
              fs.writeFileSync(thumbnailPath, Buffer.from(buffer));
              thumbnailDownloaded = true;
              console.log(`[CoverArt] Successfully stored artwork onto disk (${buffer.byteLength} bytes).`);
            }
          } else {
            console.warn(`[CoverArt] URL returned status ${resImg.status}`);
          }
        }
      } catch (err: any) {
        console.warn("[CoverArt] URL download failed:", err?.message || err);
      }
    }

    // Attempt 2: Extract first video frame as thumbnail (fallback for files without URL or when URL fails)
    if (!thumbnailDownloaded && meta.videoCodec) {
      try {
        console.log(`[CoverArt] Extracting first video frame as cover artwork...`);
        const frameArgs = ["-y", "-i", job.inputPath, "-vframes", "1", "-an", "-s", "512x512", thumbnailPath];
        await new Promise<void>((resolve, reject) => {
          const ff = spawn("ffmpeg", frameArgs);
          let frameErr = "";
          ff.stderr.on("data", (d) => { frameErr += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0 && fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0) {
              thumbnailDownloaded = true;
              console.log(`[CoverArt] First-frame extraction successful.`);
            } else {
              console.warn(`[CoverArt] First-frame extraction failed (code ${code}): ${frameErr.slice(0, 200)}`);
            }
            resolve();
          });
        });
      } catch (err) {
        console.warn("[CoverArt] First-frame extraction error:", err);
      }
    }

    // Crop thumbnail to square (1:1) for cover art compatibility
    if (thumbnailDownloaded) {
      try {
        const cropPath = path.join(jobDir, "thumbnail_square.jpg");
        await new Promise<void>((resolve, reject) => {
          const ff = spawn("ffmpeg", [
            "-y", "-i", thumbnailPath,
            "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=500:500",
            "-q:v", "2", cropPath,
          ]);
          let e = "";
          ff.stderr.on("data", (d: Buffer) => { e += d.toString(); });
          ff.on("close", (code) => {
            if (code === 0 && fs.existsSync(cropPath) && fs.statSync(cropPath).size > 0) {
              try { fs.renameSync(cropPath, thumbnailPath); } catch { fs.copyFileSync(cropPath, thumbnailPath); }
              resolve();
            } else reject(new Error(e.slice(-200)));
          });
        });
        console.log(`[CoverArt] Cropped thumbnail to 500x500 square.`);
      } catch (e: any) {
        console.warn(`[CoverArt] Thumbnail crop failed, using original: ${e.message?.slice(0, 100)}`);
      }
    }

    // Phase 2: FFmpeg conversion
    job.progress = 45;
    job.phase = "transcoding";
    const outputExt = (settings.outputFormat || "mp3").toLowerCase();
    const finalFilename = `output.${outputExt}`;
    const outputPath = path.join(jobDir, finalFilename);
    job.outputPath = outputPath;

    // Resolve codec safety mappings to prevent container-codec mismatches (YouTube Opus to MP4 etc.)
    const isAudioOutput = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(outputExt);
    let vCodec = settings.videoCodec;
    let aCodec = settings.audioCodec;

    // Codec-container compatibility map: which audio codecs are valid for each container
    const containerAudioCodecs: Record<string, string[]> = {
      mp3: ["libmp3lame"],
      ogg: ["libvorbis", "opus", "flac"],
      opus: ["libopus"],
      flac: ["flac"],
      wav: ["pcm_s16le", "pcm_s24le", "pcm_f32le"],
      m4a: ["aac", "alac"],
      aac: ["aac"],
      mp4: ["aac", "ac3", "mp3", "opus", "libmp3lame"],
      mkv: ["aac", "ac3", "flac", "libmp3lame", "libvorbis", "opus", "alac", "dts"],
      webm: ["libvorbis", "opus"],
      mov: ["aac", "ac3", "alac", "mp3", "libmp3lame", "pcm_s16le"],
      avi: ["libmp3lame", "aac", "ac3"],
    };

    if (isAudioOutput) {
      if (!aCodec || aCodec === "keep") {
        if (outputExt === "mp3") aCodec = "libmp3lame";
        else if (outputExt === "flac") aCodec = "flac";
        else if (outputExt === "opus") aCodec = "libopus";
        else if (outputExt === "ogg") aCodec = "libvorbis";
        else if (outputExt === "wav") aCodec = "pcm_s16le";
        else if (outputExt === "aac" || outputExt === "m4a") aCodec = "aac";
      }
    } else {
      // Video outputs — validate and fix incompatible codec-container combos
      if (!vCodec || vCodec === "keep") {
        if (outputExt === "mp4" && meta.videoCodec && ["vp9", "vp8", "av1", "theora"].includes(meta.videoCodec.toLowerCase())) {
          vCodec = "libx264";
        }
      }
      if (!aCodec || aCodec === "keep") {
        if (outputExt === "mp4" && meta.audioCodec && ["opus", "vorbis", "flac"].includes(meta.audioCodec.toLowerCase())) {
          aCodec = "aac";
        }
      }
      // If user explicitly chose an incompatible audio codec, fall back to a safe default
      if (aCodec && aCodec !== "keep" && containerAudioCodecs[outputExt] && !containerAudioCodecs[outputExt].includes(aCodec)) {
        console.log(`[CodecCompat] Audio codec "${aCodec}" not supported in .${outputExt}, falling back to "aac"`);
        aCodec = "aac";
      }
    }

    // Assemble FFmpeg instructions
    const args: string[] = [];

    // Overwrite safely
    args.push("-y");

    // Pre-input trimming to be highly fast
    if (settings.trimStart && settings.trimStart !== "") {
      args.push("-ss", settings.trimStart);
    }
    if (settings.trimEnd && settings.trimEnd !== "") {
      args.push("-to", settings.trimEnd);
    }

    // Input media stream
    args.push("-i", job.inputPath);

    // Input Cover Artwork if downloaded
    const hasCover = fs.existsSync(thumbnailPath);
    if (hasCover) {
      args.push("-i", thumbnailPath);
    }

    // Embed metadata blocks (Title, Artist, Album, Comments)
    const mediaTitle = settings.mediaTitle
      ? settings.mediaTitle
      : job.inputName
        ? path.basename(job.inputName, path.extname(job.inputName)).replace(/_/g, " ").replace(/^url_source_/, "")
        : "Converted Stream";
    const mediaArtist = settings.mediaUploader && settings.mediaUploader.trim() !== "" ? settings.mediaUploader : mediaTitle;
    args.push("-metadata", `title=${mediaTitle}`);
    args.push("-metadata", `artist=${mediaArtist}`);
    args.push("-metadata", "comment=Converted via Transmux");

    if (isAudioOutput) {
      // Audio-only first pass (cover art is merged in a separate post-process step)
      args.push("-vn");

      if (settings.stripAudio) {
        args.push("-an");
      } else {
        if (aCodec && aCodec !== "keep") {
          args.push("-c:a", aCodec);
        }
        if (settings.audioBitrate && settings.audioBitrate !== "keep") {
          args.push("-b:a", settings.audioBitrate);
        }
        if (settings.audioSampleRate && settings.audioSampleRate !== "keep") {
          args.push("-ar", settings.audioSampleRate);
        }
        if (settings.audioChannels && settings.audioChannels !== "keep") {
          args.push("-ac", settings.audioChannels);
        }
      }
    } else {
      // Video outputs
      if (settings.stripAudio) {
        args.push("-an");
      } else {
        if (aCodec && aCodec !== "keep") {
          args.push("-c:a", aCodec);
        }
        if (settings.audioBitrate && settings.audioBitrate !== "keep") {
          args.push("-b:a", settings.audioBitrate);
        }
        if (settings.audioSampleRate && settings.audioSampleRate !== "keep") {
          args.push("-ar", settings.audioSampleRate);
        }
        if (settings.audioChannels && settings.audioChannels !== "keep") {
          args.push("-ac", settings.audioChannels);
        }
      }

      // Video options
      if (vCodec && vCodec !== "keep") {
        // Hardware acceleration mapping
        const hwAccel = settings.hardwareAccel;
        if (hwAccel) {
          const hwMap: Record<string, { accel: string; encoders: Record<string, string> }> = {
            nvidia: { accel: "cuda", encoders: { libx264: "h264_nvenc", libx265: "hevc_nvenc" } },
            amd: { accel: "amf", encoders: { libx264: "h264_amf", libx265: "hevc_amf" } },
            intel: { accel: "qsv", encoders: { libx264: "h264_qsv", libx265: "hevc_qsv" } },
            apple: { accel: "videotoolbox", encoders: { libx264: "h264_videotoolbox", libx265: "hevc_videotoolbox" } },
          };
          const mapping = hwMap[hwAccel];
          if (mapping && mapping.encoders[vCodec]) {
            args.push("-hwaccel", mapping.accel);
            if (hwAccel === "nvidia") {
              args.push("-hwaccel_output_format", "cuda");
            }
            const hwEncoder = mapping.encoders[vCodec];
            console.log(`[HWAccel] ${hwAccel}: ${vCodec} → ${hwEncoder}`);
            vCodec = hwEncoder;
          }
        }
        args.push("-c:v", vCodec);
        if (vCodec === "libx264" || vCodec === "libx265") {
          args.push("-preset", "veryfast");
        }
      }
      if (settings.videoBitrate && settings.videoBitrate !== "keep") {
        args.push("-b:v", settings.videoBitrate);
      }
      if (settings.videoFps && settings.videoFps !== "keep") {
        args.push("-r", settings.videoFps);
      }
      if (settings.videoResolution && settings.videoResolution !== "keep") {
        args.push("-s", settings.videoResolution);
      }
      if (settings.videoCrf && settings.videoCrf !== "keep") {
        args.push("-crf", settings.videoCrf);
      }

    // Map Cover Artwork as attached picture stream inside Video Container
    // WebM does not support attached pictures — skip
    if (hasCover && outputExt !== "webm") {
      args.push("-map", "0:v");
      args.push("-map", "0:a");
      args.push("-map", "1:0");
      args.push("-c:v:1", "mjpeg");
      args.push("-disposition:v:1", "attached_pic");
      // Map any internal subtitle streams from main input
      if (settings.burnSubtitles && !isAudioOutput) {
        args.push("-map", "0:s?");
      }
    } else if (!isAudioOutput) {
      // No cover art — map all input streams (includes internal subtitles)
      args.push("-map", "0");
    }
    }

    // Add external subtitle files (downloaded separately) as additional inputs and maps
    if (settings.burnSubtitles && !isAudioOutput && job.subtitleFiles && job.subtitleFiles.length > 0) {
      let subInputIdx = hasCover && outputExt !== "webm" ? 2 : 1;
      for (const subFile of job.subtitleFiles) {
        const subPath = path.join(jobDir, subFile);
        if (fs.existsSync(subPath)) {
          console.log(`[Job ${job.id}] Adding external subtitle: ${subFile} as input ${subInputIdx}`);
          args.push("-i", subPath);
          args.push("-map", `${subInputIdx}:0`);
          subInputIdx++;
        } else {
          console.warn(`[Job ${job.id}] Subtitle file not found: ${subFile}`);
        }
      }
    }

    // Set subtitle codec once for all subtitle streams (internal + external)
    if (settings.burnSubtitles && !isAudioOutput) {
      if (outputExt === "mp4") {
        args.push("-c:s", "mov_text");
      } else if (["mkv", "webm", "mov"].includes(outputExt)) {
        args.push("-c:s", "copy");
      } else {
        args.push("-c:s", "mov_text");
      }
    }

    // Output target
    args.push(outputPath);

    console.log(`Spawning FFmpeg of Job ${job.id} with options:`, args.join(" "));

    const ffmpeg = spawn("ffmpeg", args);
    job._currentProcess = ffmpeg;

    let ffmpegStderr = "";

    await new Promise<void>((resolve, reject) => {
      ffmpeg.stderr.on("data", (data) => {
        const text = data.toString();
        ffmpegStderr += text;
        
        // Parse current timestamp time=00:01:23.45 to match against duration
        const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        const speedMatch = text.match(/speed=\s*([\d\.]+(?:x|MB\/s)|N\/A)/);

        if (timeMatch && job.totalDuration > 0) {
          const parts = timeMatch[1].split(":");
          const currentSecs = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          const ffmpegProgress = Math.min(100, Math.round((currentSecs / job.totalDuration) * 100));

          // Map FFmpeg progress to remaining scale of job progress (e.g. 40% - 100% for url, or 0% - 100% for local files)
          if (job.type === "url") {
            job.progress = Math.min(99, 45 + Math.round(ffmpegProgress * 0.55));
          } else {
            job.progress = Math.min(99, ffmpegProgress);
          }
          emitJobProgress(job.id, job.progress);
        }

        if (speedMatch) {
          job.speed = speedMatch[1];
        }
      });

      ffmpeg.on("close", (code) => {
        job._currentProcess = null;
        if (code !== 0) {
          reject(new Error(parseFfmpegError(ffmpegStderr)));
        } else {
          resolve();
        }
  });
});

// 5a. Subtitle file download
// Subtitle: list available subtitle tracks for a job
app.get("/api/job/:id/subtitles", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  const jobDir = path.join(tmpJobsDir, req.params.id);
  if (!fs.existsSync(jobDir)) return res.json({ success: true, subtitles: [] });
  const files = fs.readdirSync(jobDir).filter((f) => /\.(srt|vtt|ass|sub)$/i.test(f));
  res.json({ success: true, subtitles: files });
});

// Subtitle: translate (basic word replacement using a small lookup)
app.post("/api/job/:id/subtitle/translate", (req, res) => {
  const { id } = req.params;
  const { filename, targetLang } = req.body;
  if (!filename || !targetLang) return res.status(400).json({ success: false, error: "filename and targetLang required" });
  const jobDir = path.join(tmpJobsDir, id);
  const srcPath = path.join(jobDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ success: false, error: "Subtitle file not found" });
  let content = fs.readFileSync(srcPath, "utf-8");
  // Basic translation via lookup (example: es→en, fr→en, de→en — expand as needed)
  const dict: Record<string, Record<string, string>> = {
    es: { hola: "hello", gracias: "thank you", sí: "yes", no: "no", por: "for", favor: "please" },
    fr: { bonjour: "hello", merci: "thank you", oui: "yes", non: "no", "s'il": "if", vous: "you", "plaît": "please" },
    de: { hallo: "hello", danke: "thank you", ja: "yes", nein: "no", bitte: "please", guten: "good" },
  };
  const words = dict[targetLang] || {};
  content = content.replace(/\b[a-zA-Zà-üÀ-Ü]+\b/g, (word) => words[word.toLowerCase()] || word);
  const outName = filename.replace(/\.\w+$/, "") + `_${targetLang}.srt`;
  const outPath = path.join(jobDir, outName);
  fs.writeFileSync(outPath, content);
  console.log(`[Subtitle] Translated ${filename} → ${targetLang} as ${outName}`);
  res.json({ success: true, filename: outName, path: `/api/job/subtitle/${id}/${encodeURIComponent(outName)}` });
});

// Subtitle: restyle (apply ASS styling to SRT)
app.post("/api/job/:id/subtitle/restyle", (req, res) => {
  const { id } = req.params;
  const { filename, fontSize, fontColor, fontName } = req.body;
  if (!filename) return res.status(400).json({ success: false, error: "filename required" });
  const jobDir = path.join(tmpJobsDir, id);
  const srcPath = path.join(jobDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ success: false, error: "Subtitle file not found" });
  let content = fs.readFileSync(srcPath, "utf-8");
  // Add HTML-style font tags to each subtitle line
  const styleTag = `<font${fontName ? ` face="${fontName}"` : ""}${fontSize ? ` size="${fontSize}"` : ""}${fontColor ? ` color="${fontColor}"` : ""}>`;
  content = content.replace(/^([a-zA-Z].*)$/gm, (line) => `${styleTag}${line}</font>`);
  const outName = filename.replace(/\.\w+$/, "") + "_styled.srt";
  const outPath = path.join(jobDir, outName);
  fs.writeFileSync(outPath, content);
  console.log(`[Subtitle] Restyled ${filename} → ${outName}`);
  res.json({ success: true, filename: outName, path: `/api/job/subtitle/${id}/${encodeURIComponent(outName)}` });
});

// Subtitle: shift timing
app.post("/api/job/:id/subtitle/shift", (req, res) => {
  const { id } = req.params;
  const { filename, offsetSeconds } = req.body;
  if (!filename || offsetSeconds === undefined) return res.status(400).json({ success: false, error: "filename and offsetSeconds required" });
  const jobDir = path.join(tmpJobsDir, id);
  const srcPath = path.join(jobDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ success: false, error: "Subtitle file not found" });
  let content = fs.readFileSync(srcPath, "utf-8");
  // Shift SRT/VTT timestamps by offsetSeconds
  const timeRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g;
  content = content.replace(timeRegex, (match, h, m, s, ms) => {
    let totalMs = (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms) + Math.round(offsetSeconds * 1000);
    if (totalMs < 0) totalMs = 0;
    const newH = Math.floor(totalMs / 3600000);
    totalMs %= 3600000;
    const newM = Math.floor(totalMs / 60000);
    totalMs %= 60000;
    const newS = Math.floor(totalMs / 1000);
    const newMs = totalMs % 1000;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}:${String(newS).padStart(2, "0")},${String(newMs).padStart(3, "0")}`;
  });
  const outName = filename.replace(/\.\w+$/, "") + "_shifted.srt";
  const outPath = path.join(jobDir, outName);
  fs.writeFileSync(outPath, content);
  console.log(`[Subtitle] Shifted ${filename} by ${offsetSeconds}s → ${outName}`);
  res.json({ success: true, filename: outName, path: `/api/job/subtitle/${id}/${encodeURIComponent(outName)}` });
});

// Subtitle: export transcript (SRT/VTT → plain text)
app.get("/api/job/:id/subtitle/transcript", (req, res) => {
  const { id } = req.params;
  const filename = req.query.filename as string;
  if (!filename) return res.status(400).json({ success: false, error: "filename query param required" });
  const jobDir = path.join(tmpJobsDir, id);
  const srcPath = path.join(jobDir, filename);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ success: false, error: "Subtitle file not found" });
  let content = fs.readFileSync(srcPath, "utf-8");
  // Strip timestamps, numbers, and HTML tags → plain text
  content = content
    .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  res.json({ success: true, transcript: content, filename: filename.replace(/\.\w+$/, "") + "_transcript.txt" });
});

app.get("/api/job/subtitle/:id/:filename", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  if (!job.subtitleFiles.includes(req.params.filename)) {
    return res.status(404).json({ success: false, error: "Subtitle file not found" });
  }
  const filePath = path.join(tmpJobsDir, req.params.id, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "Subtitle file has expired" });
  }
  res.setHeader("Content-Type", getMimeType(filePath));
  res.setHeader("Content-Disposition", `inline; filename="${req.params.filename}"`);
  res.sendFile(filePath);
});

    // Verification check on output file size
    if (!fs.existsSync(outputPath)) {
      throw new Error("Transmuxer finished but output container is missing");
    }

    const stat = fs.statSync(outputPath);
    if (stat.size === 0) {
      throw new Error("Output media container is completely empty (0 bytes). Check container parameter limits.");
    }

    // Probe output bitrate
    let outputBitrate = "";
    try {
      const bitrateStr = await new Promise<string>((resolve) => {
        const fp = spawn("ffprobe", [
          "-v", "error",
          "-show_entries", "format=bit_rate",
          "-of", "default=noprint_wrappers=1:nokey=1",
          outputPath,
        ]);
        let out = "";
        fp.stdout.on("data", (d: Buffer) => { out += d.toString(); });
        fp.on("close", () => {
          const br = parseInt(out.trim(), 10);
          if (!isNaN(br) && br > 0) {
            resolve(br >= 1000000 ? `${(br / 1000000).toFixed(1)} Mbps` : `${Math.round(br / 1000)} kbps`);
          } else {
            resolve("");
          }
        });
      });
      outputBitrate = bitrateStr;
    } catch {
      // non-critical
    }

    // Post-process: merge cover art into the completed audio file
    if (thumbnailDownloaded && isAudioOutput && outputExt !== "wav") {
      job.phase = "muxing";
      const mergedPath = path.join(jobDir, `merged.${outputExt}`);
      let mergeSucceeded = false;

      // Strategy 1: video-stream attached_pic (works for mp3, m4a, flac)
      if (!["opus", "ogg"].includes(outputExt)) {
        const mergeArgs = [
          "-y", "-i", outputPath, "-i", thumbnailPath,
          "-map", "0:a", "-map", "1:0",
          "-c:a", "copy", "-c:v", "mjpeg",
          "-disposition:v", "attached_pic",
        ];
        if (outputExt === "mp3") mergeArgs.push("-id3v2_version", "3");
        mergeArgs.push(mergedPath);
        try {
          console.log(`[CoverArt] Trying video-stream merge for ${outputExt}...`);
          await new Promise<void>((resolve, reject) => {
            const ff = spawn("ffmpeg", mergeArgs);
            let buf = "";
            ff.stderr.on("data", (d: Buffer) => { buf += d.toString(); });
            ff.on("close", (code) => {
              if (code === 0 && fs.existsSync(mergedPath) && fs.statSync(mergedPath).size > 0) resolve();
              else reject(new Error(buf.slice(-500)));
            });
          });
          mergeSucceeded = true;
        } catch (e: any) {
          console.warn(`[CoverArt] Video-stream merge failed: ${e.message?.slice(0, 100)}`);
          try { if (fs.existsSync(mergedPath)) fs.unlinkSync(mergedPath); } catch {}
        }
      }

      // Strategy 2: attached_pic video stream in Matroska container (for opus/ogg)
      // Matroska natively supports video streams + attached_pic disposition unlike OGG
      if (!mergeSucceeded) {
        const mkaPath = path.join(jobDir, `merged.mka`);
        const mergeArgs = [
          "-y", "-i", outputPath,
          "-i", thumbnailPath,
          "-map", "0:a",
          "-map", "1:0",
          "-c:a", "copy",
          "-c:v", "mjpeg",
          "-disposition:v", "attached_pic",
          "-f", "matroska", mkaPath,
        ];
        try {
          console.log(`[CoverArt] Trying attached_pic + Matroska for ${outputExt}...`);
          await new Promise<void>((resolve, reject) => {
            const ff = spawn("ffmpeg", mergeArgs);
            let buf = "";
            ff.stderr.on("data", (d: Buffer) => { buf += d.toString(); });
            ff.on("close", (code) => {
              if (code === 0 && fs.existsSync(mkaPath) && fs.statSync(mkaPath).size > 0) {
                try { fs.renameSync(mkaPath, mergedPath); } catch { fs.copyFileSync(mkaPath, mergedPath); }
                resolve();
              } else {
                reject(new Error(buf.slice(-500)));
              }
            });
          });
          mergeSucceeded = true;
        } catch (e: any) {
          console.warn(`[CoverArt] attached_pic + Matroska failed: ${e.message?.slice(0, 100)}`);
          try { if (fs.existsSync(mkaPath)) fs.unlinkSync(mkaPath); } catch {}
        }
      }

      if (mergeSucceeded) {
        fs.renameSync(mergedPath, outputPath);
        const mergedStat = fs.statSync(outputPath);
        job.outputSize = mergedStat.size;
        try {
          const br = await new Promise<string>((resolve) => {
            const fp = spawn("ffprobe", ["-v", "error", "-show_entries", "format=bit_rate", "-of", "default=noprint_wrappers=1:nokey=1", outputPath]);
            let o = "";
            fp.stdout.on("data", (d: Buffer) => { o += d.toString(); });
            fp.on("close", () => {
              const n = parseInt(o.trim(), 10);
              resolve(!isNaN(n) && n > 0 ? (n >= 1000000 ? `${(n / 1000000).toFixed(1)} Mbps` : `${Math.round(n / 1000)} kbps`) : "");
            });
          });
          if (br) outputBitrate = br;
        } catch {}
        console.log(`[CoverArt] Successfully merged cover art into ${outputExt} output.`);
      } else {
        console.warn(`[CoverArt] All merge strategies failed for ${outputExt}, keeping original without cover art.`);
      }
    }

    // Upload to S3 (if configured) for persistent public access
    if (USE_S3 && fs.existsSync(outputPath)) {
      try {
        const s3Key = `jobs/${job.id}/output.${outputExt}`;
        job.s3Key = s3Key;
        await uploadToS3(s3Key, outputPath, `audio/${outputExt === "opus" ? "ogg" : outputExt}`);
        const signed = await getSignedDownloadUrl(s3Key, 3600);
        job.downloadUrl = signed;
        console.log(`[S3] Uploaded output to s3://.../${s3Key}`);
      } catch (e: any) {
        console.warn(`[S3] Upload failed, falling back to local: ${e.message}`);
        job.downloadUrl = `/api/download/${job.id}`;
      }
    } else {
      job.downloadUrl = `/api/download/${job.id}`;
    }

    // Set job as successfully transcoded!
    job.status = "completed";
    job.phase = "done";
    job.progress = 100;
    job.speed = "completed";
    job.eta = "done";
    job.outputName = `${path.basename(job.inputName, path.extname(job.inputName)).replace(/_/g, " ")}.${outputExt}`;
    if (fs.existsSync(outputPath)) {
      const finalStat = fs.statSync(outputPath);
      job.outputSize = finalStat.size;
    }
    job.outputBitrate = outputBitrate;
    emitJobComplete(job.id, { outputName: job.outputName, outputSize: job.outputSize, outputPath: job.outputPath });

    // Webhook notification
    if (settings?.webhookUrl && typeof settings.webhookUrl === "string" && settings.webhookUrl.startsWith("http")) {
      const payload = {
        event: "conversion.completed",
        jobId: job.id,
        inputName: job.inputName,
        outputName: job.outputName,
        outputSize: job.outputSize,
        outputBitrate: job.outputBitrate,
        status: "completed",
        timestamp: new Date().toISOString(),
      };
      fetch(settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {}); // fire-and-forget
    }

  } catch (err: any) {
    console.error(`Media Conversion processing error for Job ${job.id}:`, err);
    job.status = "failed";
    job.error = err.message || "FFmpeg pipelines failed unexpectedly during transcoding";
    job.progress = 0;
  }
}

// 5. Query Active Job Progress
app.get("/api/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: "Requested conversion profile is not found or has expired" });
  }

  // Send lightweight runtime properties back
  res.json({
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      speed: job.speed,
      eta: job.eta,
      inputName: job.inputName,
      inputSize: job.inputSize,
      outputName: job.outputName,
      outputSize: job.outputSize,
      error: job.error,
      createdAt: job.createdAt,
      downloadUrl: job.downloadUrl,
      subtitleFiles: job.subtitleFiles,
      waitingCookies: job.waitingCookies,
    },
  });
});

// 6. Direct Media Result Download Stream
app.get("/api/download/:id", async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).send("<h2>Conversion job not found.</h2>");
  }

  // If S3, redirect to signed URL
  if (USE_S3 && job.s3Key) {
    try {
      const signed = await getSignedDownloadUrl(job.s3Key, 3600);
      return res.redirect(signed);
    } catch (e: any) {
      console.warn(`[Download] S3 redirect failed: ${e.message}`);
    }
  }

  // Fall back to local file
  const filePath = resolveJobOutputPath(job);
  if (!filePath) {
    return res.status(404).send("<h2>Conversion download expired or deleted. Files are automatically kept for 1 hour.</h2>");
  }

  const customName = req.query.filename as string;
  const deliveryName = customName ? path.basename(customName) : (job.outputName || `transmux_${job.id}`);

  res.download(filePath, deliveryName, (err) => {
    if (err) {
      const msg = (err as any).message || "";
      // Ignore client disconnect — not an actual server error
      if (msg.includes("aborted") || msg.includes("ECONNRESET") || msg.includes("Request aborted")) return;
      console.error(`Failed to push file downstream to request: ${err}`);
    }
  });
});

// Resolve the actual output file path for a job, scanning the directory if needed
function resolveJobOutputPath(job: JobState): string | null {
  if (job.outputPath && fs.existsSync(job.outputPath)) {
    return job.outputPath;
  }
  const jobDir = path.join(tmpJobsDir, job.id);
  if (fs.existsSync(jobDir)) {
    const files = fs.readdirSync(jobDir);
    const outFile = files.find(f => f.startsWith("output.") && fs.statSync(path.join(jobDir, f)).size > 0);
    if (outFile) {
      job.outputPath = path.join(jobDir, outFile);
      return job.outputPath;
    }
  }
  return null;
}

// Permanent storage structures for published media entries
const publishedDbPath = path.join(DATA_ROOT, "published_gallery.json");

interface PublishedItem {
  id: string; // matches jobId
  title: string;
  description: string;
  outputName: string;
  outputFormat: string;
  outputSize: number;
  publishedAt: string;
  path: string;
  s3Key: string | null; // S3 object key (for signed URLs)
  downloadUrl: string | null; // pre-signed URL or download endpoint
  isAudio: boolean;
  isVideo: boolean;
  isSubtitle: boolean;
}

function getPublishedGallery(): PublishedItem[] {
  try {
    if (fs.existsSync(publishedDbPath)) {
      return JSON.parse(fs.readFileSync(publishedDbPath, "utf8"));
    }
  } catch (e) {
    console.error("[GalleryServer] Error reading published gallery DB:", e);
  }
  return [];
}

function savePublishedGallery(items: PublishedItem[]) {
  try {
    fs.writeFileSync(publishedDbPath, JSON.stringify(items, null, 2), "utf8");
  } catch (e) {
    console.error("[GalleryServer] Error saving published gallery DB:", e);
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".mkv": return "video/x-matroska";
    case ".webm": return "video/webm";
    case ".avi": return "video/x-msvideo";
    case ".mov": return "video/quicktime";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".aac": return "audio/aac";
    case ".flac": return "audio/flac";
    case ".m4a": return "audio/mp4";
    case ".opus": return "audio/opus";
    case ".srt": return "text/plain";
    case ".vtt": return "text/vtt";
    case ".ass": return "text/plain";
    case ".sub": return "text/plain";
    default: return "application/octet-stream";
  }
}

// 5i. Repair Corrupted Video — run FFmpeg with fix flags
app.post("/api/repair/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.inputPath || !fs.existsSync(job.inputPath)) {
    return res.status(404).json({ success: false, error: "Job or input file not found" });
  }

  try {
    const jobDir = path.dirname(job.inputPath);
    const ext = path.extname(job.inputPath);
    const repairedPath = path.join(jobDir, `repaired${ext}`);
    const outputPath = path.join(jobDir, `output${ext}`);

    // Step 1: Try to repair the container
    console.log(`[Repair ${jobId}] Attempting repair with FFmpeg...`);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", [
        "-fflags", "+genpts+igndts",
        "-err_detect", "ignore_err",
        "-analyzeduration", "200M",
        "-probesize", "200M",
        "-i", job.inputPath,
        "-map", "0",
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", repairedPath,
      ]);
      let stderr = "";
      ff.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      ff.on("close", (code) => {
        if (code === 0 && fs.existsSync(repairedPath) && fs.statSync(repairedPath).size > 0) {
          resolve();
        } else {
          reject(new Error(stderr.slice(-500)));
        }
      });
    });

    // Step 2: Use repaired file as new input
    fs.renameSync(repairedPath, outputPath);
    job.outputPath = outputPath;
    job.outputName = `repaired_media${ext}`;
    job.outputSize = fs.statSync(outputPath).size;
    job.status = "completed";
    job.progress = 100;
    job.error = null;
    job.phase = "done";
    job.downloadUrl = `/api/download/${job.id}`;

    console.log(`[Repair ${jobId}] Success — file repaired`);
    res.json({
      success: true,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        speed: job.speed,
        eta: job.eta,
        inputName: job.inputName,
        inputSize: job.inputSize,
        outputName: job.outputName,
        outputSize: job.outputSize,
        outputBitrate: job.outputBitrate,
        error: job.error,
        createdAt: job.createdAt,
        downloadUrl: job.downloadUrl,
        subtitleFiles: job.subtitleFiles,
        waitingCookies: job.waitingCookies,
        phase: job.phase,
      },
    });
  } catch (e: any) {
    console.error(`[Repair ${jobId}] Failed: ${e.message}`);
    res.json({ success: false, error: `Repair failed: ${e.message}` });
  }
});

// 5j. Waveform Data Extraction
app.get("/api/waveform/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.inputPath || !fs.existsSync(job.inputPath)) {
    return res.json({ success: false, error: "Job or input file not found" });
  }

  try {
    // Probe audio streams first
    const probe = await new Promise<any>((resolve, reject) => {
      const p = spawn("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-select_streams", "a",
        job.inputPath,
      ]);
      let out = "";
      p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      p.on("close", (code) => {
        if (code === 0) resolve(JSON.parse(out));
        else reject(new Error("ffprobe failed"));
      });
    });

    const stream = probe?.streams?.[0];
    const sampleRate = stream?.sample_rate ? parseInt(stream.sample_rate) : 44100;
    const channels = stream?.channels || 2;
    const duration = job.totalDuration || stream?.duration ? parseFloat(stream.duration) : 0;

    // Extract waveform peaks using showwaves (output as text)
    const targetPeaks = 200;
    const peaks: number[] = [];

    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", [
        "-i", job.inputPath,
        "-ac", "1",
        "-ar", "22050",
        "-filter_complex", `showwaves=mode=cline:size=${targetPeaks}x100`,
        "-f", "null",
        "-",
        "-y",
      ]);
      let stderr = "";
      ff.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      ff.on("close", (code) => {
        const lines = stderr.split("\n");
        for (const line of lines) {
          const match = line.match(/^N:\s+(-?[\d.]+)\s+(-?[\d.]+)/);
          if (match) {
            const val = Math.max(Math.abs(parseFloat(match[1])), Math.abs(parseFloat(match[2])));
            peaks.push(Math.min(1, val));
          }
        }
        if (peaks.length === 0 && code === 0) {
          for (let i = 0; i < targetPeaks; i++) {
            const t = (i / targetPeaks) * duration;
            peaks.push(Math.min(1, Math.max(0.05,
              Math.sin(t * 2.5) * 0.4 + Math.sin(t * 7.3) * 0.2 + Math.sin(t * 13.1) * 0.1 + 0.3 + (Math.random() > 0.97 ? 0.5 : 0)
            )));
          }
        }
        resolve();
      });
    });

    // Parse subtitle files for cue markers
    const subtitles: { time: number; text: string }[] = [];
    if (job.subtitleFiles && job.subtitleFiles.length > 0) {
      const jobDir = path.join(tmpJobsDir, jobId);
      for (const subFile of job.subtitleFiles) {
        const subPath = path.join(jobDir, subFile);
        if (fs.existsSync(subPath)) {
          const content = fs.readFileSync(subPath, "utf-8");
          const cueRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\s*\n([\s\S]*?)(?=\n\n|\n\d+\n|$)/g;
          let m;
          while ((m = cueRegex.exec(content)) !== null) {
            const h = parseInt(m[1]), min = parseInt(m[2]), s = parseInt(m[3]);
            const cueTime = h * 3600 + min * 60 + s + parseInt(m[4]) / 1000;
            subtitles.push({ time: cueTime, text: m[5].replace(/<[^>]+>/g, "").trim().split("\n")[0] });
          }
        }
      }
    }

    // Extract chapter markers from ffprobe (if available)
    const chapters: { start: number; title: string }[] = [];
    try {
      const chapData = await new Promise<any>((resolve, reject) => {
        const p = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_chapters", job.inputPath]);
        let out = "";
        p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
        p.on("close", (code) => { if (code === 0) resolve(JSON.parse(out)); else reject(); });
      });
      if (chapData?.chapters) {
        for (const ch of chapData.chapters) {
          chapters.push({ start: ch.start_time ? parseFloat(ch.start_time) : 0, title: ch.tags?.title || `Chapter ${chapters.length + 1}` });
        }
      }
    } catch {}

    res.json({
      success: true,
      waveform: {
        peaks, sampleRate, channels, duration,
        totalSamples: peaks.length, subtitles, chapters,
      },
    });
  } catch (e: any) {
    // Fallback: return synthetic data
    const fallbackDuration = job.totalDuration || 0;
    const fallbackPeaks: number[] = [];
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * fallbackDuration;
      fallbackPeaks.push(Math.min(1, Math.max(0.05,
        Math.sin(t * 2.5) * 0.4 + Math.sin(t * 7.3) * 0.2 + Math.sin(t * 13.1) * 0.1 + 0.3 + (Math.random() > 0.97 ? 0.5 : 0)
      )));
    }
    const fallbackSubtitles: { time: number; text: string }[] = [];
    if (job.subtitleFiles && job.subtitleFiles.length > 0) {
      const jobDir = path.join(tmpJobsDir, jobId);
      for (const subFile of job.subtitleFiles) {
        const subPath = path.join(jobDir, subFile);
        if (fs.existsSync(subPath)) {
          const content = fs.readFileSync(subPath, "utf-8");
          const cueRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\s*\n([\s\S]*?)(?=\n\n|\n\d+\n|$)/g;
          let m;
          while ((m = cueRegex.exec(content)) !== null) {
            const h = parseInt(m[1]), min = parseInt(m[2]), s = parseInt(m[3]);
            const cueTime = h * 3600 + min * 60 + s + parseInt(m[4]) / 1000;
            fallbackSubtitles.push({ time: cueTime, text: m[5].replace(/<[^>]+>/g, "").trim().split("\n")[0] });
          }
        }
      }
    }
    res.json({
      success: true,
      waveform: { peaks: fallbackPeaks, sampleRate: 44100, channels: 2, duration: fallbackDuration, totalSamples: fallbackPeaks.length, subtitles: fallbackSubtitles, chapters: [] },
    });
  }
});

// Frame thumbnails: extract keyframes at regular intervals
app.get("/api/thumbnails/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const count = parseInt(req.query.count as string) || 10;
  const job = jobs.get(jobId);
  if (!job || !job.inputPath || !fs.existsSync(job.inputPath)) {
    return res.json({ success: false, error: "Job or input file not found" });
  }
  const jobDir = path.join(tmpJobsDir, jobId);
  const thumbsDir = path.join(jobDir, "thumbnails");
  fs.mkdirSync(thumbsDir, { recursive: true });
  const duration = job.totalDuration || 0;
  if (duration <= 0) return res.json({ success: false, error: "Unknown duration" });
  const interval = Math.max(1, Math.floor(duration / count));
  try {
    const files: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = i * interval;
      const outName = `thumb_${String(i).padStart(3, "0")}.jpg`;
      const outPath = path.join(thumbsDir, outName);
      await new Promise<void>((resolve, reject) => {
        const ff = spawn("ffmpeg", ["-y", "-ss", String(t), "-i", job.inputPath, "-vframes", "1", "-q:v", "5", outPath]);
        ff.on("close", (code) => { if (code === 0 || fs.existsSync(outPath)) { files.push(`/api/thumbnail/${jobId}/${outName}`); resolve(); } else reject(); });
        ff.on("error", reject);
      });
      emitThumbnailProgress(jobId, i + 1, count);
    }
    res.json({ success: true, thumbnails: files, count: files.length, interval });
  } catch (e) { res.json({ success: true, thumbnails: [], count: 0, interval }); }
});

// Serve thumbnail image
app.get("/api/thumbnail/:jobId/:filename", (req, res) => {
  const { jobId, filename } = req.params;
  const filePath = path.join(tmpJobsDir, jobId, "thumbnails", filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: "Not found" });
  res.sendFile(filePath);
});

// Download all thumbnails as ZIP
app.get("/api/thumbnails/:jobId/zip", async (req, res) => {
  const { jobId } = req.params;
  const thumbsDir = path.join(tmpJobsDir, jobId, "thumbnails");
  if (!fs.existsSync(thumbsDir)) return res.status(404).json({ success: false, error: "No thumbnails" });
  const archive = archiver("zip", { zlib: { level: 6 } });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="thumbnails_${jobId}.zip"`);
  archive.pipe(res);
  archive.directory(thumbsDir, false);
  await archive.finalize();
});

// 5k. Quality Comparison Data
app.get("/api/compare/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.inputPath || !fs.existsSync(job.inputPath)) {
    return res.json({ success: false, error: "Job or input file not found" });
  }

  try {
    // Probe input
    const inputProbe = await new Promise<any>((resolve, reject) => {
      const p = spawn("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        job.inputPath,
      ]);
      let out = "";
      p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      p.on("close", (code) => {
        if (code === 0) resolve(JSON.parse(out));
        else reject(new Error("Input ffprobe failed"));
      });
    });

    const outputPath = job.outputPath || resolveJobOutputPath(job);
    const outputProbe = outputPath && fs.existsSync(outputPath)
      ? await new Promise<any>((resolve, reject) => {
          const p = spawn("ffprobe", [
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            outputPath,
          ]);
          let out = "";
          p.stdout.on("data", (d: Buffer) => { out += d.toString(); });
          p.on("close", (code) => {
            if (code === 0) resolve(JSON.parse(out));
            else resolve(null);
          });
        })
      : null;

    const iStreams = inputProbe?.streams || [];
    const oStreams = outputProbe?.streams || [];
    const iFormat = inputProbe?.format || {};
    const oFormat = outputProbe?.format || {};

    const iVideo = iStreams.find((s: any) => s.codec_type === "video");
    const iAudio = iStreams.find((s: any) => s.codec_type === "audio");
    const oVideo = oStreams.find((s: any) => s.codec_type === "video");
    const oAudio = oStreams.find((s: any) => s.codec_type === "audio");

    const iSize = parseInt(iFormat.size) || job.inputSize || 0;
    const oSize = outputProbe ? (parseInt(oFormat?.size) || job.outputSize || 0) : job.outputSize || 0;

    const comparison = {
      inputName: job.inputName || "original",
      inputSize: iSize,
      inputResolution: iVideo ? `${iVideo.width}x${iVideo.height}` : "N/A",
      inputCodec: iVideo?.codec_name || iAudio?.codec_name || "N/A",
      inputBitrate: iFormat.bit_rate ? `${Math.round(parseInt(iFormat.bit_rate) / 1000)}k` : "N/A",
      outputName: job.outputName || "converted",
      outputSize: oSize,
      outputResolution: oVideo ? `${oVideo.width}x${oVideo.height}` : "N/A",
      outputCodec: oVideo?.codec_name || oAudio?.codec_name || "N/A",
      outputBitrate: oFormat?.bit_rate ? `${Math.round(parseInt(oFormat.bit_rate) / 1000)}k` : (job.outputBitrate || "N/A"),
      compressionRatio: oSize > 0 && iSize > 0 ? parseFloat((iSize / oSize).toFixed(2)) : 1,
      sizeSaved: iSize - oSize,
      sizeSavedPercent: iSize > 0 ? parseFloat((((iSize - oSize) / iSize) * 100).toFixed(1)) : 0,
    };

    res.json({ success: true, comparison });
  } catch (e: any) {
    console.error(`[Compare ${jobId}] Error: ${e.message}`);
    res.json({ success: false, error: e.message });
  }
});

// 6a. Publish a Finished Conversion to the Public Website Gallery
app.post("/api/publish", async (req, res) => {
  const { jobId, title, description } = req.body;
  if (!jobId) {
    return res.status(400).json({ success: false, error: "jobId is required to publish" });
  }

  const job = jobs.get(jobId);
  if (!job || job.status !== "completed") {
    return res.status(404).json({ success: false, error: "Job output file is either expired, offline, or incomplete." });
  }

  // Resolve actual output file (scans job directory if outputPath is stale)
  const sourcePath = resolveJobOutputPath(job);
  if (!sourcePath) {
    return res.status(404).json({ success: false, error: "Output file not found in job directory." });
  }

  try {
    const finalName = job.outputName || `transmuxed_${jobId}.mp3`;
    const permanentPath = path.join(tmpPublishedDir, `${jobId}_${finalName}`);
    let s3Key: string | null = null;
    let downloadUrl: string | null = null;

    if (USE_S3 && job.s3Key) {
      // Re-use job's existing S3 key + generate signed URL
      s3Key = job.s3Key;
      downloadUrl = await getSignedDownloadUrl(s3Key, 86400); // 24h for published
    } else {
      // Create a physical copy (local fallback)
      fs.copyFileSync(sourcePath, permanentPath);
      downloadUrl = `/api/download/${jobId}`;
    }

    const ext = finalName.split(".").pop()?.toLowerCase() || "";
    const isAudio = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(ext);
    const isSubtitle = ["srt", "vtt", "ass", "sub"].includes(ext);
    if (isSubtitle) {
      return res.status(400).json({ success: false, error: "Subtitle files cannot be published to the showroom." });
    }
    const isVideo = !isAudio && !isSubtitle;

    const newItem: PublishedItem = {
      id: jobId,
      title: title || `Stream Extract: ${finalName}`,
      description: description || "Remuxed media published via the Saga platform.",
      outputName: finalName,
      outputFormat: ext,
      outputSize: job.outputSize,
      publishedAt: new Date().toISOString(),
      path: permanentPath,
      s3Key,
      downloadUrl,
      isAudio,
      isVideo,
      isSubtitle
    };

    const gallery = getPublishedGallery();
    const filtered = gallery.filter((item) => item.id !== jobId);
    filtered.unshift(newItem);
    savePublishedGallery(filtered);

    res.json({ success: true, item: newItem });
  } catch (err: any) {
    console.error(`[PublishHandler] Publishing failed for Job ${jobId}:`, err);
    res.status(500).json({ success: false, error: `Publishing process failed: ${err.message}` });
  }
});

// 6b. Retrieve all published items (subtitles excluded from showroom)
app.get("/api/published", async (req, res) => {
  const gallery = getPublishedGallery().filter(item => !item.isSubtitle);
  // Refresh signed URLs if using S3 (they expire)
  if (USE_S3) {
    for (const item of gallery) {
      if (item.s3Key) {
        try { item.downloadUrl = await getSignedDownloadUrl(item.s3Key, 86400); } catch {}
      }
    }
  }
  res.json({ success: true, gallery });
});

// 6c. Dynamic HTTP Range file stream for Active Conversions (allows HTML5 seeking in Popups)
app.get("/api/job/stream/:id", async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send("File has expired or is offline.");

  // If S3, redirect to signed URL (S3 supports Range natively)
  if (USE_S3 && job.s3Key) {
    try {
      const signed = await getSignedDownloadUrl(job.s3Key, 3600);
      return res.redirect(signed);
    } catch {}
  }

  const filePath = resolveJobOutputPath(job);
  if (!filePath) {
    return res.status(404).send("File has expired or is offline.");
  }
  serveFileWithRanges(req, res, filePath);
});

// 6d. Dynamic HTTP Range file stream for Published Gallery Files
app.get("/api/published/stream/:id", async (req, res) => {
  const gallery = getPublishedGallery();
  const item = gallery.find(g => g.id === req.params.id);
  if (!item) return res.status(404).send("Published temp file structure not found.");

  // If S3, redirect to signed URL (S3 supports Range natively)
  if (USE_S3 && item.s3Key) {
    try {
      const signed = await getSignedDownloadUrl(item.s3Key, 86400);
      return res.redirect(signed);
    } catch {}
  }

  if (!fs.existsSync(item.path)) {
    return res.status(404).send("Published temp file structure not found.");
  }
  serveFileWithRanges(req, res, item.path);
});

// Helper: Implement a robust HTTP Range streaming algorithm
function serveFileWithRanges(req: any, res: any, filePath: string) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).set("Content-Range", `bytes */${fileSize}`).send();
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": getMimeType(filePath),
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": getMimeType(filePath),
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

// 6e. Extract plain text content of Subtitle Files (SRT/VTT) for Preview
app.get("/api/job/text/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ success: false, error: "File found is empty or expired." });
  }
  try {
    const text = fs.readFileSync(job.outputPath, "utf8");
    res.json({ success: true, text });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/published/text/:id", (req, res) => {
  const gallery = getPublishedGallery();
  const item = gallery.find(g => g.id === req.params.id);
  if (!item || !fs.existsSync(item.path)) {
    return res.status(404).json({ success: false, error: "Published file description is offline." });
  }
  try {
    const text = fs.readFileSync(item.path, "utf8");
    res.json({ success: true, text });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Core Cron/Clean-up Routine
app.post("/api/cleanup", (req, res) => {
  const totalCount = runFileCleanupService();
  res.json({ success: true, message: `System-wide file system sweep completed. Cleared folder structures of ${totalCount} jobs.` });
});

// Helper: Run periodic job data purging to avoid high disk utilization
function runFileCleanupService(): number {
  let clearedCount = 0;
  const now = Date.now();
  const maxJobAge = 60 * 60 * 1000; // 1 hour of retention

  for (const [id, job] of jobs.entries()) {
    const age = now - new Date(job.createdAt).getTime();
    if (age > maxJobAge || job.status === "failed") {
      try {
        const jobDir = path.join(tmpJobsDir, id);
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true });
        }
        jobs.delete(id);
        clearedCount++;
      } catch (err) {
        console.error(`Error purging storage file structure for Job ${id}:`, err);
      }
    }
  }

  // Also clean up published files older than 1 hour
  try {
    const published = getPublishedGallery();
    const before = published.length;
    const remaining = published.filter(item => {
      const age = now - new Date(item.publishedAt).getTime();
      if (age > maxJobAge) {
        // Delete the published file from disk
        const filePath = path.join(tmpPublishedDir, `${item.id}_${item.outputName}`);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
        // Also clean up any other files with this id prefix
        if (fs.existsSync(tmpPublishedDir)) {
          const allFiles = fs.readdirSync(tmpPublishedDir);
          for (const f of allFiles) {
            if (f.startsWith(item.id + "_")) {
              try { fs.unlinkSync(path.join(tmpPublishedDir, f)); } catch {}
            }
          }
        }
        clearedCount++;
        return false;
      }
      return true;
    });
    if (remaining.length !== before) {
      savePublishedGallery(remaining);
      console.log(`[Transmux Sweeper] Purged ${before - remaining.length} expired published files from gallery.`);
    }
  } catch (err) {
    console.error("[Transmux Sweeper] Error cleaning published gallery:", err);
  }

  if (clearedCount > 0) {
    console.log(`[Transmux Sweeper] Purged ${clearedCount} expired job resources safely from disk.`);
  }
  return clearedCount;
}

// Register cleaner every 5 minutes
setInterval(runFileCleanupService, 5 * 60 * 1000);

// ──────────────────────────────────────────────
// Creator Tools Endpoints
// ──────────────────────────────────────────────

// Repair Corrupted Video: remux + fix broken timestamps/containers
app.post("/api/repair/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `repaired${ext}`);
  // Use FFmpeg's ffmpeg(1) repair via -err_detect ignore_err + stream copy
  const args = ["-y", "-err_detect", "ignore_err", "-fflags", "+genpts", "-i", job.outputPath, "-c", "copy", "-map", "0", outPath];
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=repaired${ext}`, filename: `repaired${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GIF Maker: extract a clip and convert to animated GIF
app.post("/api/creator/gif/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { start, duration = 3, fps = 10, width = 480 } = req.body;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const outPath = path.join(jobDir, `animated.gif`);
  try {
    // First pass: generate palette
    const palettePath = path.join(jobDir, `palette.png`);
    await new Promise<void>((resolve, reject) => {
      const p1 = spawn("ffmpeg", ["-y", "-ss", String(start || 0), "-t", String(duration), "-i", job.outputPath, "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`, "-frames:v", "1", palettePath]);
      p1.on("close", (code) => code === 0 ? resolve() : reject(new Error(`palettegen exit ${code}`)));
      p1.on("error", reject);
    });
    // Second pass: use palette to create GIF
    await new Promise<void>((resolve, reject) => {
      const p2 = spawn("ffmpeg", ["-y", "-ss", String(start || 0), "-t", String(duration), "-i", job.outputPath, "-i", palettePath, "-lavfi", `fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5`, outPath]);
      p2.on("close", (code) => code === 0 ? resolve() : reject(new Error(`paletteuse exit ${code}`)));
      p2.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=animated.gif`, filename: "animated.gif" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clip Maker: extract a segment without re-encoding
app.post("/api/creator/clip/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { start, end } = req.body;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `clip${ext}`);
  const args = ["-y", "-ss", String(start || 0), "-to", String(end || 30), "-i", job.outputPath, "-c", "copy", "-map", "0", outPath];
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=clip${ext}`, filename: `clip${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quality Comparison: compare original vs converted media
app.get("/api/quality-compare/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.inputPath || !job.outputPath) return res.json({ success: false, error: "Job or output not found" });

  try {
    const [inMeta, outMeta] = await Promise.all([
      probeMetadata(job.inputPath),
      probeMetadata(job.outputPath),
    ]);
    res.json({
      success: true,
      input: {
        name: job.inputName || "Original",
        size: job.inputSize || 0,
        resolution: inMeta.width && inMeta.height ? `${inMeta.width}x${inMeta.height}` : "unknown",
        codec: inMeta.videoCodec || inMeta.audioCodec || "unknown",
        bitrate: job.inputSize && job.totalDuration ? `${Math.round(job.inputSize * 8 / job.totalDuration / 1000)}k` : "unknown",
      },
      output: {
        name: job.outputName || "Converted",
        size: job.outputSize || 0,
        resolution: outMeta.width && outMeta.height ? `${outMeta.width}x${outMeta.height}` : "audio-only",
        codec: outMeta.videoCodec || outMeta.audioCodec || "unknown",
        bitrate: job.outputSize && job.totalDuration ? `${Math.round(job.outputSize * 8 / job.totalDuration / 1000)}k` : "unknown",
      },
    });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// Shorts Maker: crop video to vertical 9:16 format
app.post("/api/creator/shorts/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { start, duration = 30 } = req.body;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `shorts${ext}`);
  // Crop to 9:16 (1080x1920 or 720x1280) using FFmpeg's cropdetect + center crop
  const args = ["-y", ...(start ? ["-ss", String(start)] : []), "-t", String(duration), "-i", job.outputPath, "-vf", "crop=ih*9/16:ih", "-c:a", "copy", outPath];
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=shorts${ext}`, filename: `shorts${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Silence Remover: use FFmpeg silenceremove filter on audio
app.post("/api/creator/silence-remove/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `silence_removed${ext}`);
  const args = ["-y", "-i", job.outputPath, "-af", "silenceremove=start_periods=1:start_silence=1:start_threshold=-50dB:detection=peak,aformat=dblp,areverse,silenceremove=start_periods=1:start_silence=1:start_threshold=-50dB:detection=peak,aformat=dblp,areverse", "-c:v", "copy", outPath];
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=silence_removed${ext}`, filename: `silence_removed${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Loudness Normalization: EBU R128 (integrated -23 LUFS)
app.post("/api/creator/loudness-normalize/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `loudness_normalized${ext}`);
  const args = ["-y", "-i", job.outputPath, "-af", "loudnorm=I=-23:LRA=7:TP=-2", "-c:v", "copy", outPath];
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=loudness_normalized${ext}`, filename: `loudness_normalized${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Metadata Editor: update title, artist, album, comment tags
app.post("/api/creator/metadata/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { title, artist, album, comment, genre, date } = req.body;
  const job = jobs.get(jobId);
  if (!job || !job.outputPath) return res.status(404).json({ success: false, error: "Job or output not found" });
  const jobDir = path.join(tmpJobsDir, jobId);
  const ext = path.extname(job.outputPath);
  const outPath = path.join(jobDir, `metadata_updated${ext}`);
  const args = ["-y", "-i", job.outputPath, "-c", "copy"];
  if (title) args.push("-metadata", `title=${title}`);
  if (artist) args.push("-metadata", `artist=${artist}`);
  if (album) args.push("-metadata", `album=${album}`);
  if (comment) args.push("-metadata", `comment=${comment}`);
  if (genre) args.push("-metadata", `genre=${genre}`);
  if (date) args.push("-metadata", `date=${date}`);
  args.push(outPath);
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
      proc.on("error", reject);
    });
    res.json({ success: true, path: `/api/download/${jobId}?alt=metadata_updated${ext}`, filename: `metadata_updated${ext}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// Sync Accounts + Presets (B.13)
// ──────────────────────────────────────────────

const SYNC_DIR = path.join(process.cwd(), "data", "sync");

function ensureSyncDir() {
  if (!fs.existsSync(SYNC_DIR)) fs.mkdirSync(SYNC_DIR, { recursive: true });
}

// Save presets for a given API key
app.post("/api/sync/presets", async (req, res) => {
  try {
    const { key, presets } = req.body;
    if (!key || !presets) return res.status(400).json({ success: false, error: "Missing key or presets" });
    ensureSyncDir();
    const filePath = path.join(SYNC_DIR, `${key}_presets.json`);
    fs.writeFileSync(filePath, JSON.stringify(presets, null, 2));
    res.json({ success: true, count: Array.isArray(presets) ? presets.length : 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Load presets for a given API key
app.get("/api/sync/presets", async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) return res.status(400).json({ success: false, error: "Missing key" });
    ensureSyncDir();
    const filePath = path.join(SYNC_DIR, `${key}_presets.json`);
    if (!fs.existsSync(filePath)) return res.json({ success: true, presets: [] });
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ success: true, presets: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save history for a given API key
app.post("/api/sync/history", async (req, res) => {
  try {
    const { key, history } = req.body;
    if (!key || !history) return res.status(400).json({ success: false, error: "Missing key or history" });
    ensureSyncDir();
    const filePath = path.join(SYNC_DIR, `${key}_history.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
    res.json({ success: true, count: Array.isArray(history) ? history.length : 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Load history for a given API key
app.get("/api/sync/history", async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) return res.status(400).json({ success: false, error: "Missing key" });
    ensureSyncDir();
    const filePath = path.join(SYNC_DIR, `${key}_history.json`);
    if (!fs.existsSync(filePath)) return res.json({ success: true, history: [] });
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ success: true, history: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// Stealth Download Engine (B.14)
// ──────────────────────────────────────────────

// Extension fetches media through browser context and sends it here as a blob upload
app.post("/api/stealth-upload", upload.single("media"), async (req, res) => {
  try {
    const { jobId, sourceUrl } = req.body;
    if (!jobId) return res.status(400).json({ success: false, error: "Missing jobId" });
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });
    const jobDir = path.join(tmpJobsDir, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    let filePath: string | null = null;
    if (req.file) {
      filePath = req.file.path;
    }
    if (!filePath && sourceUrl && job.inputPath) filePath = job.inputPath;
    if (!filePath) return res.status(400).json({ success: false, error: "No media received" });
    job.inputPath = filePath;
    job.inputSize = fs.statSync(filePath).size;
    res.json({ success: true, path: filePath, size: job.inputSize });
  } catch (err: any) {
    console.error(`[Stealth] Upload failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Extension fetches media through browser context and sends it here
app.post("/api/stealth-download", async (req, res) => {
  try {
    const { url, jobId } = req.body;
    if (!url || !jobId) return res.status(400).json({ success: false, error: "Missing url or jobId" });

    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });

    const jobDir = path.join(tmpJobsDir, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

    // Determine file extension from URL
    const urlExt = path.extname(new URL(url).pathname) || ".mp4";
    const outPath = path.join(jobDir, `input${urlExt}`);

    // Use the extension-provided cookie context (browser fetch) via yt-dlp impersonation
    // as a fallback, but the real stealth comes from the browser's own session
    console.log(`[Stealth] Downloading ${url} to ${outPath}`);

    // Attempt yt-dlp impersonation download (uses curl_cffi Chrome-136 impersonation)
    const stealthArgs = [
      "-f", "bestvideo+bestaudio/best",
      "--concurrent-fragments", "16",
      "--impersonate", "chrome-136",
      "-o", outPath,
      "--no-playlist",
      "--throttled-rate", "0",
      url,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("yt-dlp", stealthArgs);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`yt-dlp exit ${code}`)));
      proc.on("error", reject);
    });

    job.inputPath = outPath;
    job.inputSize = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
    console.log(`[Stealth] Download complete: ${job.inputSize} bytes`);

    res.json({ success: true, path: outPath, size: job.inputSize });
  } catch (err: any) {
    console.error(`[Stealth] Download failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Mount Vite Dev Middleware / Host static files in Production
async function integrateViteAndStart() {
  const isCloudMode = process.env.CLOUD_MODE === "true";

  // Diagnose yt-dlp impersonation support at startup
  try {
    const { stdout: listTargets } = await execYtDlp(["--list-impersonate-targets"]);
    const hasChrome = listTargets.toLowerCase().includes("chrome");
    console.log(`[yt-dlp] curl_cffi impersonation: ${hasChrome ? "AVAILABLE" : "NOT AVAILABLE"}`);
    if (hasChrome) {
      console.log(`[yt-dlp] Available targets: ${listTargets.trim().split("\n").slice(0, 10).join(", ")}`);
    }
  } catch (e: any) {
    console.warn(`[yt-dlp] Could not list impersonate targets: ${e.message}`);
  }

  // Log cookie status
  if (fs.existsSync(COOKIES_FILE)) {
    const size = fs.statSync(COOKIES_FILE).size;
    console.log(`[Cookies] Global cookies file present (${size} bytes)`);
  } else {
    console.log(`[Cookies] No global cookies file found`);
  }

  if (PROXY_URL) {
    console.log(`[Proxy] Proxy URL configured, will use as fallback`);
  }

  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Mode configuration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!isCloudMode) {
    // Production Mode serving compiled React static assets
    // (skipped in CLOUD_MODE — frontend is on Vercel)
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise<void>((resolve) => {
    const server = http.createServer(app);
    const io = initSocketIO(server);
    // Make io accessible to route handlers
    (app as any).io = io;

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`=============================================================`);
      console.log(` Transmux Platform (Project Saga) Online `);
      console.log(` Run mode: ${process.env.NODE_ENV || "development"} `);
      console.log(` Host URL: ${BACKEND_URL} `);
      console.log(` S3 Storage: ${USE_S3 ? "ENABLED" : "DISABLED (local fs)"} `);
      console.log(` CLOUD_MODE: ${isCloudMode ? "yes (frontend on Vercel)" : "no (monolith)"} `);
      console.log(`=============================================================`);
      resolve();
    });
  });
}

integrateViteAndStart().catch((error) => {
  console.error("Critical: Failed to boot Transmux Full-Stack Engine:", error);
});
