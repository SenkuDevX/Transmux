export type ConversionMode = 'audio' | 'video' | 'subtitle' | 'image';

export type JobStatus = 'queued' | 'downloading' | 'converting' | 'uploading' | 'completed' | 'failed' | 'expired';

export interface ConversionJob {
  id: string;
  status: JobStatus;
  mode: ConversionMode;
  sourceUrl?: string;
  inputName: string;
  inputSize: number;
  outputFormat: OutputFormat;
  options: any;
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

export type OutputFormat = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'aac' | 'flac' | 'opus' | 'aiff' | 'mp4' | 'mkv' | 'webm' | 'mov' | 'avi' | 'flv' | 'm4v' | '3gp' | 'ts' | 'srt' | 'vtt' | 'ass' | 'sub' | 'png' | 'jpg' | 'webp' | 'gif';

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