/**
 * Jobs API Routes
 * POST /api/jobs/upload  — Create job from file upload (multipart/form-data)
 * POST /api/jobs/url     — Create job from URL (application/json)
 * POST /api/jobs/probe   — Probe file metadata only
 * GET  /api/jobs         — List recent jobs
 * GET  /api/jobs/:id     — Get job status
 * GET  /api/jobs/:id/download — Download output
 * DELETE /api/jobs/:id   — Cancel/delete job
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sanitizeFilename from 'sanitize-filename';
import { z } from 'zod';
import { createJob, getJob, deleteJob, getOutputPath, listJobs } from '../services/jobManager';
import { probeFile } from '../services/ffmpeg';
import { uploadRateLimiter } from '../middleware/rateLimit';
import { TEMP_DIR, MAX_FILE_SIZE_MB } from '../utils/constants';
import { logger } from '../utils/logger';

export const jobRoutes = Router();

// ─── Multer config ────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, file, cb) => {
    const safe = sanitizeFilename(file.originalname) || 'upload';
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const dangerous = /\.(exe|bat|sh|cmd|ps1|msi|dll|so)$/i;
    if (dangerous.test(file.originalname)) {
      return cb(new Error('File type not permitted'));
    }
    cb(null, true);
  },
});

// ─── Validation schemas ────────────────────────────────────────────────────

const jobMetaSchema = z.object({
  mode: z.enum(['audio', 'video', 'subtitle', 'image']),
  outputFormat: z.string().min(1).max(20),
  options: z.record(z.unknown()).optional().default({}),
});

const urlJobSchema = z.object({
  mode: z.enum(['audio', 'video', 'subtitle', 'image']),
  outputFormat: z.string().min(1).max(20),
  options: z.record(z.unknown()).optional().default({}),
  sourceUrl: z.string().url(),
});

// ─── List jobs ─────────────────────────────────────────────────────────────

jobRoutes.get('/', (_req: Request, res: Response) => {
  const jobs = listJobs().slice(0, 50);
  res.json({ jobs });
});

// ─── Create job from FILE UPLOAD (multipart/form-data) ────────────────────
// Frontend sends: FormData with 'file' + 'meta' (JSON string)

jobRoutes.post(
  '/upload',
  uploadRateLimiter,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // multer puts text fields in req.body as plain strings
      const rawMeta = req.body.meta;
      if (!rawMeta) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Missing meta field — send job settings as JSON string in the "meta" form field' });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMeta);
      } catch {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'meta field is not valid JSON' });
      }

      const body = jobMetaSchema.parse(parsed);
      const job = await createJob(body, req.file.path);
      res.status(201).json({ job });
    } catch (err: any) {
      logger.error('Create upload job error', err);
      // Clean up on failure
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400).json({ error: err.message || 'Invalid request' });
    }
  }
);

// ─── Create job from URL (application/json) ───────────────────────────────

jobRoutes.post('/url', uploadRateLimiter, async (req: Request, res: Response) => {
  try {
    const body = urlJobSchema.parse(req.body);
    const job = await createJob(
      { mode: body.mode, outputFormat: body.outputFormat, options: body.options ?? {}, sourceUrl: body.sourceUrl },
      undefined,
    );
    res.status(201).json({ job });
  } catch (err: any) {
    logger.error('Create URL job error', err);
    res.status(400).json({ error: err.message || 'Invalid request' });
  }
});

// ─── Probe metadata (no job created) ──────────────────────────────────────

jobRoutes.post(
  '/probe',
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const metadata = await probeFile(req.file.path);
      fs.unlinkSync(req.file.path);
      res.json({ metadata });
    } catch (err: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(422).json({ error: 'Could not probe file: ' + err.message });
    }
  }
);

// ─── Get job ──────────────────────────────────────────────────────────────

jobRoutes.get('/:id', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

// ─── Download output ──────────────────────────────────────────────────────

jobRoutes.get('/:id/download', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(409).json({ error: 'Job not complete yet' });

  const outputPath = getOutputPath(job);
  if (!outputPath) return res.status(410).json({ error: 'Output file expired or not found' });

  res.download(outputPath, job.outputName || 'output', (err) => {
    if (err) logger.error('Download error', err);
  });
});

// ─── Delete job ───────────────────────────────────────────────────────────

jobRoutes.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteJob(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Job not found' });
  res.json({ deleted: true });
});
