import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import type { ConversionJob, JobStatus, ConversionMode } from '../types';
import { logger, logJobComplete, logJobFailed, logJobProgress } from '../utils/logger';
import { TEMP_DIR, FILE_EXPIRY_HOURS } from '../utils/constants';
import { downloadUrl, sanitiseTitle } from './ytdlp';
import { convertMedia, buildOutputPath } from './ffmpeg';
import { uploadToCloudinary, cleanTempFile, getResourceType, isCloudinaryConfigured } from './cloudinary';
import { updateJobRecord, createJobRecord, getJobRecord } from './supabase';
import { emitJobProgress, emitJobComplete, emitJobFailed } from './websocket';
import { addJobToQueue } from './queue';

export async function createConversionJob(
  url: string,
  format: string,
  quality: string,
  mode: string,
  options: any = {}
): Promise<{ jobId: string; status: string; createdAt: string }> {
  const jobId = uuid();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + FILE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  let mediaTitle = 'Media';
  try {
    const { fetchUrlMetadata } = await import('./ytdlp');
    const metadata = await fetchUrlMetadata(url);
    mediaTitle = sanitiseTitle(metadata.title || 'Media');
  } catch {
    // Continue with default title
  }

  const job: ConversionJob = {
    id: jobId,
    status: 'queued',
    mode: mode as ConversionMode,
    sourceUrl: url,
    inputName: mediaTitle,
    inputSize: 0,
    outputFormat: format as any,
    options: getQualityOptions(mode, quality, options),
    progress: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await createJobRecord(job);
  await addJobToQueue(job);

  logger.info(`Created conversion job: ${jobId} for URL: ${url}`);
  return { jobId, status: 'queued', createdAt: now };
}

function getQualityOptions(mode: string, quality: string, userOptions: any): any {
  const qualityMap: Record<string, any> = {
    best: {},
    '720p': mode === 'video' ? { resolution: '1280x720', crf: 23 } : { bitrate: '320k' },
    '480p': mode === 'video' ? { resolution: '854x480', crf: 25 } : { bitrate: '192k' },
    '360p': mode === 'video' ? { resolution: '640x360', crf: 28 } : { bitrate: '128k' },
    '128k': { bitrate: '128k' },
    '192k': { bitrate: '192k' },
    '256k': { bitrate: '256k' },
    '320k': { bitrate: '320k' },
  };

  return { ...qualityMap[quality] || qualityMap.best, ...userOptions };
}

export async function processConversionJob(jobData: ConversionJob): Promise<ConversionJob> {
  const { id: jobId, sourceUrl, mode, outputFormat, options } = jobData;

  logger.info(`Processing job ${jobId}: ${mode} -> ${outputFormat}`);

  let inputPath: string | null = null;
  let tempDownloadPath: string | null = null;
  let mediaTitle = 'Media';

  try {
    updateJobStatus(jobId, 'downloading', 5);

    const audioOnly = mode === 'audio';
    const dl = await downloadUrl(jobId, sourceUrl!, audioOnly, (progress) => {
      updateJobStatus(jobId, 'downloading', Math.round(5 + progress * 0.3));
    });

    inputPath = dl.filePath;
    tempDownloadPath = dl.filePath;
    mediaTitle = dl.title;

    updateJobStatus(jobId, 'converting', 35);

    const outputPath = buildOutputPath(jobId, dl.title, outputFormat as any);

    await convertMedia(
      inputPath,
      outputPath,
      mode,
      outputFormat as any,
      options,
      (progress) => {
        updateJobStatus(jobId, 'converting', Math.round(35 + progress * 0.45));
      }
    );

    updateJobStatus(jobId, 'uploading', 80);

    if (!isCloudinaryConfigured()) {
      logger.warn('Cloudinary not configured, skipping upload');
      updateJobStatus(jobId, 'completed', 100);
      return getJobRecord(jobId) as Promise<ConversionJob>;
    }

    const resourceType = getResourceType(outputFormat as string);
    const uploadResult = await uploadToCloudinary(outputPath, {
      folder: 'converted-media',
      tags: ['temp', 'expires_1h'],
      resourceType,
      publicId: `job_${jobId}`,
    });

    cleanTempFile(outputPath);

    const completedJob: Partial<ConversionJob> = {
      status: 'completed',
      progress: 100,
      downloadUrl: uploadResult.secureUrl,
      cloudinaryPublicId: uploadResult.publicId,
      outputName: `${sanitiseTitle(mediaTitle)}.${outputFormat}`,
      outputSize: uploadResult.bytes,
    };

    await updateJobRecord(jobId, completedJob);

    const updatedJob = await getJobRecord(jobId);
    if (updatedJob) {
      emitJobComplete(jobId, uploadResult.secureUrl, updatedJob.expiresAt);
    }

    logJobComplete(jobId, uploadResult.secureUrl);
    return updatedJob || jobData;

  } catch (err: any) {
    logger.error(`Job ${jobId} failed`, err);
    const errorMsg = err.message || 'Conversion failed';

    await updateJobRecord(jobId, { status: 'failed', error: errorMsg });
    emitJobFailed(jobId, errorMsg);
    logJobFailed(jobId, errorMsg);

    throw err;

  } finally {
    if (inputPath && fs.existsSync(inputPath)) {
      cleanTempFile(inputPath);
    }
  }
}

async function updateJobStatus(jobId: string, status: JobStatus, progress: number): Promise<void> {
  await updateJobRecord(jobId, { status, progress });
  emitJobProgress(jobId, progress, status);
  logJobProgress(jobId, progress, status);
}

export async function getConversionJobStatus(jobId: string): Promise<ConversionJob | null> {
  return await getJobRecord(jobId);
}

export async function validateDownloadRequest(jobId: string): Promise<{
  valid: boolean;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}> {
  const job = await getJobRecord(jobId);

  if (!job) {
    return { valid: false, error: 'Job not found' };
  }

  if (job.status === 'expired') {
    return { valid: false, error: 'File has expired' };
  }

  if (job.status !== 'completed') {
    return { valid: false, error: 'Job not complete yet' };
  }

  const now = new Date();
  const expiresAt = new Date(job.expiresAt);

  if (now > expiresAt) {
    await updateJobRecord(jobId, { status: 'expired' });
    return { valid: false, error: 'File has expired' };
  }

  return {
    valid: true,
    downloadUrl: job.downloadUrl,
    expiresAt: job.expiresAt,
  };
}