export interface MediaFormat {
  formatId: string;
  extension: string;
  resolution: string;
  videoCodec: string;
  audioCodec: string;
  filesize: number;
  note: string;
}

export interface MediaMetadata {
  title: string;
  uploader?: string;
  thumbnail: string;
  duration: number; // in seconds
  extractor: string;
  formats?: MediaFormat[];
  originalUrl?: string;
  filename?: string;
  video?: { codec: string; resolution: string | null } | null;
  audio?: { codec: string; sampleRate?: number; channels?: number } | null;
  format?: string;
  size?: number;
  formatsLimited?: boolean; // true when metadata came from tv_embedded (limited to 360p)
}

export interface ConversionSettings {
  outputFormat: string;
  audioBitrate: string; // e.g. '128k', '192k', '256k', '320k', 'keep'
  audioSampleRate: string; // e.g. '44100', '48000', 'keep'
  audioChannels: string; // e.g. '1', '2', 'keep'
  videoResolution: string; // e.g. '1920x1080', '1280x720', '854x480', '640x360', 'keep'
  videoFps: string; // e.g. '24', '30', '60', 'keep'
  videoCodec: string; // e.g. 'libx264', 'libx265', 'vp9', 'libvpx', 'keep'
  audioCodec: string; // e.g. 'libmp3lame', 'aac', 'opus', 'flac', 'keep'
  videoBitrate: string; // e.g. '1M', '2M', '5M', 'keep'
  videoCrf: string; // e.g. '18', '23', '28', 'keep'
  trimStart: string; // HH:MM:SS or seconds
  trimEnd: string; // HH:MM:SS or seconds
  burnSubtitles: boolean;
  stripAudio: boolean;
  selectedFormatId: string; // for yt-dlp select formats
  thumbnailUrl?: string; // cover art URL to embed in audio
  mediaTitle?: string; // original media title for metadata tags
  mediaUploader?: string; // uploader/channel name for artist metadata
}

export interface Job {
  id: string;
  type: 'file' | 'url';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'waiting_cookies';
  progress: number; // 0 to 100
  speed: string; // e.g. "2.1x" or "1.5 MB/s"
  eta: string; // e.g. "00:15"
  inputName: string;
  inputSize: number; // in bytes
  outputName: string;
  outputSize: number; // in bytes
  outputBitrate?: string; // e.g. "192k"
  error: string | null;
  createdAt: string;
  downloadUrl: string | null;
  subtitleFiles?: string[];
  waitingCookies?: boolean;
}

export interface ConversionHistoryItem {
  jobId: string;
  inputName: string;
  outputName: string;
  outputFormat: string;
  completedAt: string;
  size: number;
  bitrate?: string;
}
