/**
 * Job Manager
 * Creates and tracks conversion jobs.
 * For URL jobs: yt-dlp downloads the file first, then FFmpeg converts it.
 * This avoids all stream-mapping issues on Windows.
 */

import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import type { ConversionJob, CreateJobRequest } from '@transmux/shared';
import { buildOutputPath, convertAudio, convertVideo, convertSubtitle, extractFrame } from './ffmpeg';
import { downloadUrl, sanitiseTitle } from './ytdlp';
import { broadcastJob } from './websocket';
import { logger } from '../utils/logger';
import { TEMP_DIR, FILE_CLEANUP_HOURS } from '../utils/constants';

const jobs = new Map<string, ConversionJob>();

export function getJob(id: string): ConversionJob | undefined {
  return jobs.get(id);
}

export function listJobs(): ConversionJob[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ─── Create job ──────────────────────────────────────────────────────────────

export async function createJob(
  req: CreateJobRequest,
  uploadedFilePath?: string,
): Promise<ConversionJob> {
  const id = uuid();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + FILE_CLEANUP_HOURS * 60 * 60 * 1000).toISOString();

  // For uploaded files use the real filename; URL jobs get a placeholder
  // that gets replaced with the actual title once yt-dlp fetches it
  const inputName = uploadedFilePath
    ? path.basename(uploadedFilePath)
    : 'Fetching title...';

  const inputStat = uploadedFilePath ? fs.statSync(uploadedFilePath) : null;

  const job: ConversionJob = {
    id,
    status: 'queued',
    mode: req.mode,
    inputName,
    inputSize: inputStat?.size || 0,
    outputFormat: req.outputFormat,
    options: req.options,
    progress: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  jobs.set(id, job);
  broadcastJob(job);

  processJob(job, uploadedFilePath, req.sourceUrl).catch(err => {
    logger.error(`Job ${id} failed`, { message: err.message });
    updateJob(id, { status: 'failed', error: err.message });
  });

  return job;
}

// ─── Process job ─────────────────────────────────────────────────────────────

async function processJob(
  job: ConversionJob,
  uploadedFilePath?: string,
  sourceUrl?: string,
): Promise<void> {
  updateJob(job.id, { status: 'processing', progress: 0 });

  let inputPath: string;
  let mediaTitle: string;
  let tempDownload: string | null = null; // track yt-dlp download for cleanup

  if (uploadedFilePath) {
    // Uploaded file — use original name (strip extension) as title
    inputPath = uploadedFilePath;
    mediaTitle = sanitiseTitle(
      path.basename(uploadedFilePath, path.extname(uploadedFilePath))
    );
  } else if (sourceUrl) {
    // URL job — let yt-dlp download the full file with merged audio+video
    // audioOnly=true skips downloading the video stream for audio conversions
    const audioOnly = job.mode === 'audio';
    updateJob(job.id, { inputName: 'Downloading...' });

    const dl = await downloadUrl(job.id, sourceUrl, audioOnly);
    inputPath = dl.filePath;
    mediaTitle = dl.title;
    tempDownload = dl.filePath;

    // Update job with the real title now that we have it
    updateJob(job.id, { inputName: `${dl.title}.${dl.ext}` });
    logger.info(`Downloaded: ${mediaTitle} (${dl.ext})`);
  } else {
    throw new Error('No input source provided');
  }

  // Build output path using the media title instead of a random ID
  const outputPath = buildOutputPathWithTitle(job.id, mediaTitle, job.outputFormat);
  logger.info(`Converting: "${inputPath}" → "${outputPath}"`);

  const onProgress = (pct: number) => updateJob(job.id, { progress: Math.round(pct) });

  switch (job.mode) {
    case 'audio':
      await convertAudio(inputPath, outputPath, job.outputFormat, job.options as any, onProgress);
      break;
    case 'video':
      await convertVideo(inputPath, outputPath, job.outputFormat, job.options as any, onProgress);
      break;
    case 'subtitle':
      await convertSubtitle(inputPath, outputPath, job.options as any, onProgress);
      break;
    case 'image':
      await extractFrame(inputPath, outputPath, job.outputFormat, job.options as any, onProgress);
      break;
    default:
      throw new Error(`Unknown mode: ${job.mode}`);
  }

  // Clean up input files after conversion
  const toDelete = [uploadedFilePath, tempDownload].filter(Boolean) as string[];
  for (const f of toDelete) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* best-effort */ }
  }

  const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
  const outputName = path.basename(outputPath);

  updateJob(job.id, {
    status: 'done',
    progress: 100,
    outputName,
    outputSize: stat?.size,
    downloadUrl: `/api/jobs/${job.id}/download`,
  });

  logger.info(`Job ${job.id} done → ${outputName} (${stat?.size ?? 0} bytes)`);
}

// ─── Build output path with human title ──────────────────────────────────────

function buildOutputPathWithTitle(jobId: string, title: string, format: string): string {
  const ext = formatToExt(format);
  const safe = sanitiseTitle(title) || 'output';
  return path.join(TEMP_DIR, `${safe}_${jobId.slice(0, 8)}.${ext}`);
}

function formatToExt(format: string): string {
  const map: Record<string, string> = {
    MP3: 'mp3', WAV: 'wav', OGG: 'ogg', M4A: 'm4a', AAC: 'aac',
    FLAC: 'flac', OPUS: 'opus', ALAC: 'm4a', AIFF: 'aiff', WMA: 'wma', AMR: 'amr',
    MP4: 'mp4', MKV: 'mkv', WEBM: 'webm', MOV: 'mov', AVI: 'avi',
    FLV: 'flv', M4V: 'm4v', '3GP': '3gp', TS: 'ts',
    SRT: 'srt', VTT: 'vtt', ASS: 'ass', SUB: 'sub',
    PNG: 'png', JPG: 'jpg', WEBP: 'webp', GIF: 'gif', 'Frame Extract': 'png',
  };
  return map[format] || format.toLowerCase();
}

// ─── Update job ──────────────────────────────────────────────────────────────

function updateJob(id: string, patch: Partial<ConversionJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(id, updated);
  broadcastJob(updated);
}

// ─── Delete job ──────────────────────────────────────────────────────────────

export function deleteJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.outputName) {
    const p = path.join(TEMP_DIR, job.outputName);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* best-effort */ }
  }
  jobs.delete(id);
  return true;
}

// ─── Get output path ─────────────────────────────────────────────────────────

export function getOutputPath(job: ConversionJob): string | null {
  if (!job.outputName) return null;
  const p = path.join(TEMP_DIR, job.outputName);
  return fs.existsSync(p) ? p : null;
}
