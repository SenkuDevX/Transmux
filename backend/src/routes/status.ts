import { Router, Request, Response } from 'express';
import { getConversionJobStatus } from '../services/jobProcessor';
import { logger } from '../utils/logger';

export const statusRoutes = Router();

statusRoutes.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId || jobId.length < 5 || jobId.length > 100) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = await getConversionJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      inputName: job.inputName,
      outputFormat: job.outputFormat,
      downloadUrl: job.downloadUrl || undefined,
      expiresAt: job.expiresAt,
      error: job.error || undefined,
    });

  } catch (err: any) {
    logger.error('Status check error', err);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});