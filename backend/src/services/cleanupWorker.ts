import cron from 'node-cron';
import { logger, logCleanupStats } from '../utils/logger';
import { CLEANUP_INTERVAL_MINUTES, FILE_EXPIRY_HOURS } from '../utils/constants';
import { getExpiredJobs, markJobsAsExpired } from './supabase';
import { deleteMultipleFromCloudinary } from './cloudinary';

let cleanupTask: cron.ScheduledTask | null = null;

export function startCleanupScheduler(): void {
  const intervalMinutes = Math.max(CLEANUP_INTERVAL_MINUTES, 5);

  cleanupTask = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
    await runCleanup();
  });

  logger.info(`Cleanup scheduler started (every ${intervalMinutes} minutes, ${FILE_EXPIRY_HOURS}h retention)`);
}

export async function runCleanup(): Promise<{ deletedCount: number; expiredCount: number; errors: string[] }> {
  const result = { deletedCount: 0, expiredCount: 0, errors: [] as string[] };

  try {
    const expiredJobs = await getExpiredJobs();

    if (expiredJobs.length === 0) {
      return result;
    }

    logger.info(`Found ${expiredJobs.length} expired jobs`);

    const publicIds = expiredJobs
      .filter(j => j.publicId)
      .map(j => j.publicId);

    const jobIds = expiredJobs.map(j => j.jobId);

    if (publicIds.length > 0) {
      try {
        await deleteMultipleFromCloudinary(publicIds);
        result.deletedCount = publicIds.length;
      } catch (err: any) {
        result.errors.push(`Cloudinary delete failed: ${err.message}`);
      }
    }

    try {
      await markJobsAsExpired(jobIds);
      result.expiredCount = jobIds.length;
    } catch (err: any) {
      result.errors.push(`Failed to mark jobs as expired: ${err.message}`);
    }

    logCleanupStats(result.deletedCount, result.expiredCount);

  } catch (err: any) {
    logger.error('Cleanup error', err);
    result.errors.push(err.message);
  }

  return result;
}

export async function forceCleanup(): Promise<{ deletedCount: number; expiredCount: number; errors: string[] }> {
  return runCleanup();
}

export function stopCleanupScheduler(): void {
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
    logger.info('Cleanup scheduler stopped');
  }
}