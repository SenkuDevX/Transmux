import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConversionJob, JobStatus } from '@transmux/shared';
import { logger } from '../utils/logger';

let supabase: SupabaseClient | null = null;

export function initializeSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    logger.warn('Supabase credentials not configured, using mock client');
    return createMockClient();
  }

  supabase = createClient(url, serviceKey || anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.info('Supabase client initialized');
  return supabase;
}

function createMockClient(): SupabaseClient {
  const mockData = new Map<string, ConversionJob>();

  return {
    from: () => ({
      insert: async (data: any) => {
        const job = data[0] as ConversionJob;
        mockData.set(job.id, job);
        return { data: [job], error: null };
      },
      update: (data: any) => ({
        eq: async (field: string, value: any) => {
          const job = mockData.get(value);
          if (job) {
            const updated = { ...job, ...data };
            mockData.set(value, updated);
          }
          return { data: [job], error: null };
        },
      }),
      select: () => ({
        eq: (field: string, value: any) => ({
          single: async () => {
            const job = mockData.get(value);
            return { data: job || null, error: job ? null : { message: 'Not found' } };
          },
          order: () => ({
            limit: async () => ({ data: Array.from(mockData.values()), error: null }),
          }),
        }),
        order: () => ({
          limit: async () => ({ data: Array.from(mockData.values()), error: null }),
        }),
      }),
      delete: () => ({
        eq: async (field: string, value: any) => {
          mockData.delete(value);
          return { data: null, error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
}

export async function createJobRecord(job: ConversionJob): Promise<void> {
  const client = initializeSupabase();
  try {
    const { error } = await client.from('jobs').insert([{
      id: job.id,
      job_id: job.id,
      source_url: job.sourceUrl || null,
      format: job.outputFormat,
      status: job.status,
      progress: job.progress,
      download_url: job.downloadUrl || null,
      cloudinary_public_id: job.cloudinaryPublicId || null,
      created_at: job.createdAt,
      expires_at: job.expiresAt,
      error: job.error || null,
    }]);

    if (error) {
      logger.error('Failed to create job record', error);
    }
  } catch (err) {
    logger.error('Exception creating job record', err);
  }
}

export async function updateJobRecord(
  jobId: string,
  updates: Partial<ConversionJob>
): Promise<void> {
  const client = initializeSupabase();
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.downloadUrl) dbUpdates.download_url = updates.downloadUrl;
    if (updates.cloudinaryPublicId) dbUpdates.cloudinary_public_id = updates.cloudinaryPublicId;
    if (updates.error) dbUpdates.error = updates.error;
    if (updates.expiresAt) dbUpdates.expires_at = updates.expiresAt;

    const { error } = await client
      .from('jobs')
      .update(dbUpdates)
      .eq('job_id', jobId);

    if (error) {
      logger.error(`Failed to update job ${jobId}`, error);
    }
  } catch (err) {
    logger.error(`Exception updating job ${jobId}`, err);
  }
}

export async function getJobRecord(jobId: string): Promise<ConversionJob | null> {
  const client = initializeSupabase();
  try {
    const { data, error } = await client
      .from('jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error || !data) return null;

    return {
      id: data.job_id,
      status: data.status as JobStatus,
      sourceUrl: data.source_url,
      inputName: data.source_url || 'Unknown',
      inputSize: 0,
      outputFormat: data.format,
      options: {},
      progress: data.progress || 0,
      downloadUrl: data.download_url,
      cloudinaryPublicId: data.cloudinary_public_id,
      error: data.error,
      createdAt: data.created_at,
      updatedAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (err) {
    logger.error(`Exception getting job ${jobId}`, err);
    return null;
  }
}

export async function getExpiredJobs(): Promise<string[]> {
  const client = initializeSupabase();
  try {
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('jobs')
      .select('job_id, cloudinary_public_id')
      .eq('status', 'completed')
      .lt('expires_at', now);

    if (error) {
      logger.error('Failed to get expired jobs', error);
      return [];
    }

    return (data || []).map((d: any) => ({
      jobId: d.job_id,
      publicId: d.cloudinary_public_id,
    }));
  } catch (err) {
    logger.error('Exception getting expired jobs', err);
    return [];
  }
}

export async function markJobsAsExpired(jobIds: string[]): Promise<void> {
  const client = initializeSupabase();
  try {
    for (const jobId of jobIds) {
      await client
        .from('jobs')
        .update({ status: 'expired' })
        .eq('job_id', jobId);
    }
  } catch (err) {
    logger.error('Exception marking jobs as expired', err);
  }
}

export async function deleteJobRecord(jobId: string): Promise<void> {
  const client = initializeSupabase();
  try {
    await client.from('jobs').delete().eq('job_id', jobId);
  } catch (err) {
    logger.error(`Exception deleting job ${jobId}`, err);
  }
}