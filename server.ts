import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import archiver from "archiver";
import { isS3Configured, uploadToS3, getSignedDownloadUrl, deleteFromS3 } from "./src/storage.js";

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
const COOKIES_FILE = path.join(DATA_ROOT, "cookies.txt");
const COOKIES_FILE_PENDING = path.join(DATA_ROOT, "cookies_pending.txt");

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
  return stderr.includes("Sign in to confirm") || stderr.includes("not a bot");
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
        "--write-subs", "--write-auto-subs", "--sub-langs", "all,-live_chat",
        "--embed-subs",
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
    };
    jobs.set(activeJobId, job);
  } else {
    // Verify uploaded file job
    const storedJob = jobs.get(activeJobId);
    if (!storedJob) {
      return res.status(404).json({ success: false, error: "Job ID not found" });
    }
    job = storedJob;
  }

  // Start the background conversion engine and immediately return a positive handshake to client
  processMediaJob(job, settings, url);

  res.json({
    success: true,
    jobId: activeJobId,
    status: "queued",
  });
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

    // Phase 1: URL stream download if needed
    if (job.type === "url" && url) {
      // If download file already exists from a previous attempt, skip download
      const existingFiles = fs.existsSync(jobDir) ? fs.readdirSync(jobDir) : [];
      const existingDownload = existingFiles.find(f => f.startsWith("input.") && !/\.(jpg|jpeg|png|webp)$/i.test(f));
      if (existingDownload) {
        console.log(`[Job ${job.id}] Download already exists, skipping download phase.`);
        job.inputPath = path.join(jobDir, existingDownload);
        job.inputSize = fs.statSync(job.inputPath).size;
        job.inputName = settings.mediaTitle || `url_source_${settings.outputFormat || 'converted'}${path.extname(existingDownload)}`;
      } else {
        job.inputName = `Downloading from URL...`;

        const formatSelection = settings.selectedFormatId && settings.selectedFormatId !== "best" && settings.selectedFormatId !== DEFAULT_FORMAT
          ? settings.selectedFormatId
          : DEFAULT_FORMAT;

        const baseDownloadArgs = [
          "-f", formatSelection,
          "--concurrent-fragments", "5",
          "-o", path.join(jobDir, "input.%(ext)s"),
          "--write-thumbnail",
          "--convert-thumbnails", "jpg",
          "--write-subs", "--write-auto-subs", "--sub-langs", "all,-live_chat",
          "--embed-subs",
          "--convert-subs", "srt",
          "--no-playlist",
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

        // Try: with cookies + impersonation → without cookies → through proxy if configured
        const downloadAttempts: string[][] = [
          addCookiesArg([...YTDLP_BASE, ...dlCookieArgs, ...baseDownloadArgs], job.id),
        ];

        if (fs.existsSync(COOKIES_FILE)) {
          downloadAttempts.push([...YTDLP_BASE, ...dlNoCookieArgs, ...baseDownloadArgs]);
        }
        if (PROXY_URL) {
          downloadAttempts.push([...YTDLP_BASE, ...dlNoCookieArgs, ...baseDownloadArgs, "--proxy", PROXY_URL]);
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

        // Look for yt-dlp thumbnail written alongside the media file
        const thumbnailFile = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && f !== "thumbnail.jpg");
        if (thumbnailFile) {
          const src = path.join(jobDir, thumbnailFile);
          try {
            fs.renameSync(src, path.join(jobDir, "thumbnail.jpg"));
            console.log(`[CoverArt] Using yt-dlp thumbnail: ${thumbnailFile}`);
          } catch {
            fs.copyFileSync(src, path.join(jobDir, "thumbnail.jpg"));
          }
        }

        // Collect subtitle files downloaded alongside the media (store as relative filenames)
        const SUB_EXTENSIONS = [".vtt", ".srt", ".ass", ".ssa", ".sub"];
        job.subtitleFiles = files.filter(f => SUB_EXTENSIONS.includes(path.extname(f).toLowerCase()));
      }
    }

    if (!job.inputPath || !fs.existsSync(job.inputPath)) {
      throw new Error("Local task source file does not exist or has expired");
    }

    // Probe stream duration and codec specs to resolve incompatibilities
    const meta = await probeMetadata(job.inputPath);
    if (!job.totalDuration || job.totalDuration === 0) {
      job.totalDuration = meta.duration;
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
    job.phase = "transcoding";
    const outputExt = (settings.outputFormat || "mp3").toLowerCase();
    const finalFilename = `output.${outputExt}`;
    const outputPath = path.join(jobDir, finalFilename);
    job.outputPath = outputPath;

    // Resolve codec safety mappings to prevent container-codec mismatches (YouTube Opus to MP4 etc.)
    const isAudioOutput = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(outputExt);
    let vCodec = settings.videoCodec;
    let aCodec = settings.audioCodec;

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
      // Video outputs
      if (!vCodec || vCodec === "keep") {
        // VP9 or AV1 source inside WebM from YouTube requires H.264 when converting to MP4 container
        if (outputExt === "mp4" && meta.videoCodec && ["vp9", "vp8", "av1", "theora"].includes(meta.videoCodec.toLowerCase())) {
          vCodec = "libx264";
        }
      }
      if (!aCodec || aCodec === "keep") {
        // Opus or Vorbis source audio requires AAC format when converting to standard MP4 container
        if (outputExt === "mp4" && meta.audioCodec && ["opus", "vorbis", "flac"].includes(meta.audioCodec.toLowerCase())) {
          aCodec = "aac";
        }
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
        args.push("-map", "0");
        args.push("-map", "1:0");
        args.push("-c:v:1", "mjpeg");
        args.push("-disposition:v:1", "attached_pic");
      }

      // Embed subtitles from source (copy without re-encode)
      args.push("-c:s", "copy");
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
    if (err) console.error(`Failed to push file downstream to request: ${err}`);
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
const tmpPublishedDir = path.join(DATA_ROOT, "published");

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
  if (clearedCount > 0) {
    console.log(`[Transmux Sweeper] Purged ${clearedCount} expired job resources safely from disk.`);
  }
  return clearedCount;
}

// Register cleaner every 5 minutes
setInterval(runFileCleanupService, 5 * 60 * 1000);


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
    app.listen(PORT, "0.0.0.0", () => {
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
