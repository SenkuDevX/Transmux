import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';
import { MAX_CONCURRENT_JOBS, JOB_TIMEOUT_MS } from '../utils/constants';
import { processConversionJob } from './jobProcessor';
import type { ConversionJob } from '@transmux/shared';

let connection: IORedis | null = null;
let conversionQueue: Queue | null = null;
let conversionWorker: Worker | null = null;

function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl && redisUrl.startsWith('redis')) {
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });
  }

  const host = process.env.UPSTASH_REDIS_HOST;
  const port = process.env.UPSTASH_REDIS_PORT;
  const password = process.env.UPSTASH_REDIS_PASSWORD;

  if (host && port) {
    return new IORedis({
      host,
      port: parseInt(port, 10),
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Upstash Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });
  }

  logger.warn('No Redis configured, using in-memory queue (demo mode)');
  return new IORedis({ maxRetriesPerRequest: null });
}

export async function initializeQueue(): Promise<void> {
  connection = createRedisConnection();

  conversionQueue = new Queue('conversion-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });

  conversionWorker = new Worker(
    'conversion-jobs',
    async (job: Job) => {
      const jobData = job.data as ConversionJob;
      logger.info(`Processing job ${jobData.id}`);
      return await processConversionJob(jobData);
    },
    {
      connection,
      concurrency: MAX_CONCURRENT_JOBS,
    }
  );

  conversionWorker.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed`, result);
  });

  conversionWorker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, err);
  });

  conversionWorker.on('error', (err) => {
    logger.error('Worker error', err);
  });

  logger.info('Queue worker initialized');
}

export async function addJobToQueue(job: ConversionJob): Promise<string> {
  if (!conversionQueue) {
    throw new Error('Queue not initialized');
  }

  const queueJob = await conversionQueue.add(
    'convert',
    job,
    {
      jobId: job.id,
      timeout: JOB_TIMEOUT_MS,
    }
  );

  logger.info(`Added job ${job.id} to queue`);
  return queueJob.id || job.id;
}

export async function getJobFromQueue(jobId: string): Promise<Job | null> {
  if (!conversionQueue) return null;
  return await conversionQueue.getJob(jobId);
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  if (!conversionQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    conversionQueue.getWaitingCount(),
    conversionQueue.getActiveCount(),
    conversionQueue.getCompletedCount(),
    conversionQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

export async function closeQueue(): Promise<void> {
  if (conversionWorker) {
    await conversionWorker.close();
  }
  if (conversionQueue) {
    await conversionQueue.close();
  }
  if (connection) {
    await connection.quit();
  }
  logger.info('Queue closed');
}

export function isQueueReady(): boolean {
  return conversionQueue !== null && connection !== null;
}