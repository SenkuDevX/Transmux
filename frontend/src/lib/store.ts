import { create } from 'zustand';
import type { ActiveJob, ConversionStatus } from './api';

interface AppState {
  url: string;
  setUrl: (url: string) => void;

  format: string;
  setFormat: (format: string) => void;

  quality: string;
  setQuality: (quality: string) => void;

  mode: 'audio' | 'video';
  setMode: (mode: 'audio' | 'video') => void;

  activeJobs: ActiveJob[];
  addJob: (job: ActiveJob) => void;
  updateJob: (jobId: string, updates: Partial<ActiveJob>) => void;
  removeJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  url: '',
  setUrl: (url) => set({ url }),

  format: 'mp3',
  setFormat: (format) => set({ format }),

  quality: 'best',
  setQuality: (quality) => set({ quality }),

  mode: 'audio',
  setMode: (mode) => set({ mode, format: mode === 'audio' ? 'mp3' : 'mp4' }),

  activeJobs: [],
  addJob: (job) => set({ activeJobs: [job, ...get().activeJobs] }),
  updateJob: (jobId, updates) => set({
    activeJobs: get().activeJobs.map(j =>
      j.jobId === jobId ? { ...j, ...updates } : j
    ),
  }),
  removeJob: (jobId) => set({
    activeJobs: get().activeJobs.filter(j => j.jobId !== jobId),
  }),
  clearCompletedJobs: () => set({
    activeJobs: get().activeJobs.filter(j =>
      j.status !== 'completed' && j.status !== 'failed' && j.status !== 'expired'
    ),
  }),
}));

export const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'];
export const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'];

export const AUDIO_QUALITIES = [
  { value: 'best', label: 'Best Quality' },
  { value: '320k', label: '320 kbps' },
  { value: '256k', label: '256 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '128k', label: '128 kbps' },
];

export const VIDEO_QUALITIES = [
  { value: 'best', label: 'Best Quality' },
  { value: '720p', label: '720p HD' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
];

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getTimeRemaining(expiresAt?: string): string {
  if (!expiresAt) return '';
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;
  if (diff <= 0) return 'Expired';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}