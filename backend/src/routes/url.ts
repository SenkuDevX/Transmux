/**
 * URL Routes
 * POST /api/url/info — Fetch metadata for a permitted URL via yt-dlp
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { fetchUrlMetadata, isUrlPermitted } from '../services/ytdlp';
import { urlRateLimiter } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

export const urlRoutes = Router();

const urlInfoSchema = z.object({
  url: z.string().url(),
});

urlRoutes.post('/info', urlRateLimiter, async (req: Request, res: Response) => {
  try {
    const { url } = urlInfoSchema.parse(req.body);

    if (!isUrlPermitted(url)) {
      return res.status(403).json({
        error: 'URL not permitted. Only content from authorized sources may be processed.',
        permitted: ['youtube.com', 'vimeo.com', 'soundcloud.com', 'twitch.tv'],
      });
    }

    const metadata = await fetchUrlMetadata(url);
    res.json({ metadata });
  } catch (err: any) {
    logger.error('URL info error', err);
    res.status(400).json({ error: err.message || 'Failed to fetch URL metadata' });
  }
});
