import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { logger } from '../utils/logger';
import { TEMP_DIR } from '../utils/constants';

function toFfmpegPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function safeBase(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    || 'output';
}

function formatToExt(format: string): string {
  const map: Record<string, string> = {
    mp3: 'mp3', wav: 'wav', ogg: 'ogg', m4a: 'm4a', aac: 'aac',
    flac: 'flac', opus: 'opus', aiff: 'aiff', wma: 'wma', amr: 'amr',
    mp4: 'mp4', mkv: 'mkv', webm: 'webm', mov: 'mov', avi: 'avi',
    flv: 'flv', m4v: 'm4v', '3gp': '3gp', ts: 'ts',
    srt: 'srt', vtt: 'vtt', ass: 'ass', sub: 'sub',
    png: 'png', jpg: 'jpg', webp: 'webp', gif: 'gif',
    frame_extract: 'png',
  };
  return map[String(format).toLowerCase()] || String(format).toLowerCase();
}

export function buildOutputPath(jobId: string, inputName: string, format: string): string {
  const rawBase = path.basename(inputName, path.extname(inputName));
  const base = safeBase(rawBase);
  const ext = formatToExt(format);
  return path.join(TEMP_DIR, `${jobId}_${base}.${ext}`);
}

function ffmpegError(err: Error, stderr?: string): Error {
  const detail = stderr ? `\nFFmpeg stderr: ${stderr.slice(-500)}` : '';
  return new Error(err.message + detail);
}

export async function probeFile(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(toFfmpegPath(filePath), (err, data) => {
      if (err) return reject(err);
      const video = data.streams.find((s: any) => s.codec_type === 'video');
      const audio = data.streams.find((s: any) => s.codec_type === 'audio');
      const fmt = data.format;

      let fps: number | undefined;
      if (video?.r_frame_rate) {
        const parts = String(video.r_frame_rate).split('/');
        fps = parts.length === 2
          ? parseInt(parts[0]) / parseInt(parts[1])
          : parseFloat(parts[0]);
      }

      resolve({
        duration: fmt.duration ? parseFloat(String(fmt.duration)) : undefined,
        size: fmt.size ? parseInt(String(fmt.size), 10) : undefined,
        format: fmt.format_name,
        width: video?.width,
        height: video?.height,
        fps,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        sampleRate: audio?.sample_rate ? parseInt(String(audio.sample_rate), 10) : undefined,
        channels: audio?.channels,
      });
    });
  });
}

export async function convertAudio(
  inputPath: string,
  outputPath: string,
  format: string,
  options: any,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(toFfmpegPath(inputPath));

    if (options.trimStart) cmd = cmd.seekInput(options.trimStart);
    if (options.trimEnd && options.trimStart !== undefined) {
      cmd = cmd.duration(options.trimEnd - (options.trimStart ?? 0));
    }

    if (options.normalize) cmd = cmd.audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11');

    const codecMap: Record<string, string> = {
      mp3: 'libmp3lame', ogg: 'libvorbis', flac: 'flac',
      aac: 'aac', opus: 'libopus', alac: 'alac',
      aiff: 'pcm_s16be', wma: 'wmav2', wav: 'pcm_s16le',
    };
    const fmt = String(format).toLowerCase();
    const codec = codecMap[fmt];
    if (codec) cmd = cmd.audioCodec(codec);

    const lossless = new Set(['flac', 'alac', 'wav', 'aiff']);
    if (options.bitrate && !lossless.has(fmt)) {
      if (fmt === 'opus') {
        const bps = options.bitrate.replace('k', '000');
        cmd = cmd.outputOptions(`-b:a ${bps}`);
      } else {
        cmd = cmd.audioBitrate(options.bitrate);
      }
    }

    if (options.channels) cmd = cmd.audioChannels(options.channels);

    cmd = cmd.noVideo();

    const outPath = toFfmpegPath(outputPath);
    logger.info(`Audio convert: "${toFfmpegPath(inputPath)}" -> "${outPath}"`);

    cmd
      .on('progress', (p: any) => onProgress(Math.min(p.percent ?? 0, 99)))
      .on('end', () => { onProgress(100); resolve(); })
      .on('error', (err: Error, _stdout: any, stderr: any) => reject(ffmpegError(err, stderr)))
      .save(outPath);
  });
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  format: string,
  options: any,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(toFfmpegPath(inputPath));

    if (options.trimStart) cmd = cmd.seekInput(options.trimStart);
    if (options.trimEnd && options.trimStart !== undefined) {
      cmd = cmd.duration(options.trimEnd - (options.trimStart ?? 0));
    }

    const vf: string[] = [];
    if (options.resolution && options.resolution !== 'original') {
      const [w, h] = options.resolution.split('x');
      vf.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`);
      vf.push(`pad=${w}:${h}:-1:-1:color=black`);
    }
    if (options.rotate) {
      const t: Record<number, string> = { 90: 'transpose=1', 180: 'transpose=2,transpose=2', 270: 'transpose=2' };
      if (t[options.rotate]) vf.push(t[options.rotate]);
    }
    if (vf.length) cmd = cmd.videoFilters(vf);

    const codecMap: Record<string, string> = {
      mp4: 'libx264', mkv: 'libx264', mov: 'libx264', m4v: 'libx264',
      webm: 'libvpx-vp9', avi: 'mpeg4', flv: 'flv',
    };
    const vcodec = options.codec || codecMap[String(format).toLowerCase()];
    if (vcodec) cmd = cmd.videoCodec(vcodec);

    const crf = options.crf !== undefined ? options.crf : 21;
    cmd = cmd.outputOptions(`-crf ${crf}`);
    if (options.preset) cmd = cmd.outputOptions(`-preset ${options.preset}`);
    if (options.fps) cmd = cmd.fps(options.fps);
    if (options.videoBitrate) cmd = cmd.videoBitrate(options.videoBitrate);

    if (format === 'mp4') cmd = cmd.outputOptions('-movflags faststart');
    if (options.removeAudio) cmd = cmd.noAudio();

    const outPath = toFfmpegPath(outputPath);
    logger.info(`Video convert: "${toFfmpegPath(inputPath)}" -> "${outPath}"`);

    cmd
      .on('progress', (p: any) => onProgress(Math.min(p.percent ?? 0, 99)))
      .on('end', () => { onProgress(100); resolve(); })
      .on('error', (err: Error, _stdout: any, stderr: any) => reject(ffmpegError(err, stderr)))
      .save(outPath);
  });
}

export async function convertMedia(
  inputPath: string,
  outputPath: string,
  mode: string,
  format: string,
  options: any,
  onProgress: (pct: number) => void
): Promise<void> {
  switch (mode) {
    case 'audio':
      return convertAudio(inputPath, outputPath, format, options, onProgress);
    case 'video':
      return convertVideo(inputPath, outputPath, format, options, onProgress);
    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }
}