import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      msg += `\n${stack}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
  ],
});

export function logJobProgress(jobId: string, progress: number, status: string): void {
  logger.info(`Job ${jobId}: ${progress}% - ${status}`);
}

export function logJobComplete(jobId: string, downloadUrl: string): void {
  logger.info(`Job ${jobId} completed: ${downloadUrl}`);
}

export function logJobFailed(jobId: string, error: string): void {
  logger.error(`Job ${jobId} failed: ${error}`);
}

export function logCleanupStats(deletedCount: number, expiredCount: number): void {
  logger.info(`Cleanup: deleted ${deletedCount} files, marked ${expiredCount} as expired`);
}