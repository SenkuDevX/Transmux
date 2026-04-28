const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function createConversionJob(params: {
  url: string;
  format: string;
  quality?: string;
  mode?: string;
}) {
  return request<{ jobId: string; status: string; createdAt: string }>('/api/convert', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createUrlJob(params: {
  sourceUrl: string;
  mode: string;
  outputFormat: string;
  options?: any;
}) {
  return createConversionJob({
    url: params.sourceUrl,
    format: params.outputFormat,
    quality: params.options?.quality,
    mode: params.mode,
  });
}

export async function createFileJob(file: File, meta: any) {
  throw new Error('File upload is not supported on this platform. Please use URL input instead.');
}

export async function getJobStatus(jobId: string) {
  return request<{
    jobId: string;
    status: string;
    progress: number;
    inputName?: string;
    outputFormat?: string;
    downloadUrl?: string;
    expiresAt?: string;
    error?: string;
  }>(`/api/status/${jobId}`);
}

export function getDownloadUrl(jobId: string): string {
  return `${BASE_URL}/api/download/${jobId}`;
}

export async function checkHealth() {
  return request<{ status: string; ffmpeg: boolean; ytdlp: boolean }>('/api/health');
}

export async function fetchUrlInfo(url: string) {
  return request<{ metadata: any }>(`/api/metadata?url=${encodeURIComponent(url)}`);
}

export type ConversionStatus = 'queued' | 'downloading' | 'converting' | 'uploading' | 'completed' | 'failed' | 'expired';

export interface ActiveJob {
  jobId: string;
  status: ConversionStatus;
  progress: number;
  inputName?: string;
  outputFormat?: string;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}