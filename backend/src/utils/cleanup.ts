/**
 * Cleanup Scheduler
 * Deletes temp files older than FILE_CLEANUP_HOURS every 15 minutes.
 */

import fs from 'fs';
import path from 'path';
import { TEMP_DIR, FILE_CLEANUP_HOURS } from './constants';
import { logger } from './logger';

export function startCleanupScheduler(): void {
  const interval = 15 * 60 * 1000; // every 15 min

  setInterval(() => {
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const cutoff = Date.now() - FILE_CLEANUP_HOURS * 60 * 60 * 1000;
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) logger.info(`Cleanup: removed ${cleaned} expired temp files`);
    } catch (err) {
      logger.error('Cleanup error', err);
    }
  }, interval);

  logger.info(`Cleanup scheduler started (${FILE_CLEANUP_HOURS}h retention)`);
}
