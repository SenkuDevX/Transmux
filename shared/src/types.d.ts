export type ConversionMode = 'audio' | 'video' | 'subtitle' | 'image';
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';
export declare const AUDIO_FORMATS: readonly ["MP3", "WAV", "OGG", "M4A", "AAC", "FLAC", "OPUS", "ALAC", "AIFF", "WMA", "AMR"];
export declare const VIDEO_FORMATS: readonly ["MP4", "MKV", "WEBM", "MOV", "AVI", "FLV", "M4V", "3GP", "TS"];
export declare const SUBTITLE_FORMATS: readonly ["SRT", "VTT", "ASS", "SUB"];
export declare const IMAGE_FORMATS: readonly ["PNG", "JPG", "WEBP", "GIF"];
export type AudioFormat = typeof AUDIO_FORMATS[number];
export type VideoFormat = typeof VIDEO_FORMATS[number];
export type SubtitleFormat = typeof SUBTITLE_FORMATS[number];
export type ImageFormat = typeof IMAGE_FORMATS[number];
export type OutputFormat = AudioFormat | VideoFormat | SubtitleFormat | ImageFormat | 'Frame Extract';
export interface AudioOptions {
    bitrate?: string;
    sampleRate?: number;
    channels?: 1 | 2;
    normalize?: boolean;
    trimStart?: number;
    trimEnd?: number;
    audioOnly?: boolean;
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
    burnSubtitles?: string;
}
export interface SubtitleOptions {
    encoding?: string;
    burnIn?: boolean;
    videoPath?: string;
}
export interface ImageOptions {
    quality?: number;
    extractFrame?: number;
    fps?: number;
}
export type ConversionOptions = AudioOptions | VideoOptions | SubtitleOptions | ImageOptions;
export interface ConversionJob {
    id: string;
    status: JobStatus;
    mode: ConversionMode;
    inputName: string;
    inputSize: number;
    outputFormat: OutputFormat;
    options: ConversionOptions;
    progress: number;
    outputName?: string;
    outputSize?: number;
    downloadUrl?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}
export interface CreateJobRequest {
    mode: ConversionMode;
    outputFormat: OutputFormat;
    options: ConversionOptions;
    sourceUrl?: string;
}
export interface JobResponse {
    job: ConversionJob;
}
export interface MediaMetadata {
    title?: string;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    videoCodec?: string;
    audioCodec?: string;
    audioBitrate?: number;
    videoBitrate?: number;
    sampleRate?: number;
    channels?: number;
    size?: number;
    thumbnail?: string;
    format?: string;
}
export interface UrlMetadata extends MediaMetadata {
    url: string;
    availableFormats?: UrlFormat[];
}
export interface UrlFormat {
    formatId: string;
    ext: string;
    resolution?: string;
    fps?: number;
    filesize?: number;
    tbr?: number;
    acodec?: string;
    vcodec?: string;
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
export interface ConversionPreset {
    id: string;
    label: string;
    mode: ConversionMode;
    outputFormat: OutputFormat;
    options: ConversionOptions;
    description?: string;
}
export declare const PRESETS: ConversionPreset[];
