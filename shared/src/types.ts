export type ConversionMode = 'audio' | 'video' | 'subtitle' | 'image';

export type JobStatus = 'queued' | 'downloading' | 'converting' | 'uploading' | 'completed' | 'failed' | 'expired';

export const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'aiff', 'wma', 'amr'] as const;
export const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm4v', '3gp', 'ts'] as const;
export const SUBTITLE_FORMATS = ['srt', 'vtt', 'ass', 'sub'] as const;
export const IMAGE_FORMATS = ['png', 'jpg', 'webp', 'gif', 'bmp', 'tiff'] as const;

export type AudioFormat = typeof AUDIO_FORMATS[number];
export type VideoFormat = typeof VIDEO_FORMATS[number];
export type SubtitleFormat = typeof SUBTITLE_FORMATS[number];
export type ImageFormat = typeof IMAGE_FORMATS[number];
export type OutputFormat = AudioFormat | VideoFormat | SubtitleFormat | ImageFormat | 'frame_extract';

export interface AudioOptions {
  bitrate?: string;
  sampleRate?: number;
  channels?: 1 | 2;
  normalize?: boolean;
  trimStart?: number;
  trimEnd?: number;
}

export interface VideoOptions {
  resolution?: string;
  fps?: number;
  videoBitrate?: string;
  codec?: string;
  crf?: number;
  preset?: string;
  removeAudio?: boolean;
  trimStart?: number;
  trimEnd?: number;
  rotate?: 0 | 90 | 180 | 270;
}

export interface SubtitleOptions {
  encoding?: string;
  burnIn?: boolean;
}

export interface ImageOptions {
  quality?: number;
  extractFrame?: number;
  fps?: number;
}

export type ConversionOptions = Partial<AudioOptions | VideoOptions | SubtitleOptions | ImageOptions>;

export interface ConversionJob {
  id: string;
  status: JobStatus;
  mode: ConversionMode;
  sourceUrl?: string;
  inputName: string;
  inputSize: number;
  outputFormat: OutputFormat;
  options: ConversionOptions;
  progress: number;
  outputName?: string;
  outputSize?: number;
  downloadUrl?: string;
  cloudinaryPublicId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface CreateJobRequest {
  url: string;
  format: OutputFormat;
  quality: 'best' | '720p' | '480p' | '360p' | '128k' | '192k' | '256k' | '320k';
  mode: ConversionMode;
  options?: ConversionOptions;
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  createdAt: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  inputName?: string;
  outputFormat?: OutputFormat;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

export interface UrlMetadata {
  title?: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  availableFormats?: UrlFormat[];
}

export interface UrlFormat {
  formatId: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  label?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok';
  ffmpeg: boolean;
  ytdlp: boolean;
  version: string;
}

export interface CleanupResponse {
  deletedCount: number;
  expiredCount: number;
  errors: string[];
}

export const QUALITY_OPTIONS = {
  audio: ['128k', '192k', '256k', '320k', 'best'] as const,
  video: ['360p', '480p', '720p', '1080p', 'best'] as const,
} as const;

export type AudioQuality = typeof QUALITY_OPTIONS.audio[number];
export type VideoQuality = typeof QUALITY_OPTIONS.video[number];
export type QualityOption = AudioQuality | VideoQuality;

export interface WebSocketEvents {
  'job-progress': { jobId: string; progress: number; status: JobStatus };
  'job-complete': { jobId: string; downloadUrl: string; expiresAt: string };
  'job-failed': { jobId: string; error: string };
  'expired': { jobId: string };
}