import { Router, Request, Response } from 'express';
import { validateDownloadRequest } from '../services/jobProcessor';
import { logger } from '../utils/logger';

export const downloadRoutes = Router();

downloadRoutes.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId || jobId.length < 5 || jobId.length > 100) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const validation = await validateDownloadRequest(jobId);

    if (!validation.valid) {
      return res.status(validation.error === 'Job not found' ? 404 : 410).json({
        error: validation.error,
      });
    }

    logger.info(`Download redirect for job ${jobId}`);
    res.redirect(302, validation.downloadUrl!);

  } catch (err: any) {
    logger.error('Download error', err);
    res.status(500).json({ error: 'Failed to process download' });
  }
});