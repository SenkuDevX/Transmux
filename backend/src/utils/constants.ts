import path from 'path';
import os from 'os';

function resolveTempDir(): string {
  const fromEnv = process.env.TEMP_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.tmpdir(), 'transmux');
}

export const TEMP_DIR = resolveTempDir();
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);
export const FILE_EXPIRY_HOURS = 1;
export const MAX_DURATION_SECONDS = parseInt(process.env.MAX_DURATION_SECONDS || '3600', 10);
export const CLEANUP_INTERVAL_MINUTES = 10;
export const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
export const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || '1800000', 10);
export const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '20', 10);