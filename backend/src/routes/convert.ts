import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createConversionJob } from '../services/jobProcessor';
import { isUrlPermitted } from '../services/ytdlp';
import { logger } from '../utils/logger';

export const convertRoutes = Router();

const convertSchema = z.object({
  url: z.string().url(),
  format: z.enum(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'aiff', 'mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm4v', '3gp', 'ts', 'srt', 'vtt', 'ass', 'sub', 'png', 'jpg', 'webp', 'gif']),
  quality: z.enum(['best', '720p', '480p', '360p', '128k', '192k', '256k', '320k']).optional().default('best'),
  mode: z.enum(['audio', 'video', 'subtitle', 'image']).optional().default('audio'),
  options: z.record(z.unknown()).optional().default({}),
});

convertRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const body = convertSchema.parse(req.body);

    if (!isUrlPermitted(body.url)) {
      return res.status(403).json({
        error: 'URL not permitted. Only content from authorized sources may be processed.',
        permitted: ['youtube.com', 'vimeo.com', 'soundcloud.com', 'twitch.tv', 'dailymotion.com', 'bilibili.com'],
      });
    }

    const result = await createConversionJob(
      body.url,
      body.format,
      body.quality,
      body.mode,
      body.options
    );

    logger.info(`Conversion job created: ${result.jobId}`);
    res.status(201).json(result);

  } catch (err: any) {
    logger.error('Create conversion error', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    res.status(400).json({ error: err.message || 'Failed to create job' });
  }
});