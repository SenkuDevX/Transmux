import { Router, Request, Response } from 'express';
import { forceCleanup } from '../services/cleanupWorker';
import { logger } from '../utils/logger';

export const cleanupRoutes = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

cleanupRoutes.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (ADMIN_SECRET && providedSecret !== ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ADMIN_SECRET && !providedSecret) {
      logger.warn('Cleanup called without admin secret');
    }

    const result = await forceCleanup();

    logger.info(`Manual cleanup: deleted ${result.deletedCount} files, expired ${result.expiredCount} jobs`);
    res.json({
      deletedCount: result.deletedCount,
      expiredCount: result.expiredCount,
      errors: result.errors,
    });

  } catch (err: any) {
    logger.error('Manual cleanup error', err);
    res.status(500).json({ error: 'Cleanup failed', details: err.message });
  }
});