import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { UrlMetadata, UrlFormat } from '../types';
import { logger } from '../utils/logger';
import { TEMP_DIR, MAX_DURATION_SECONDS } from '../utils/constants';

const execFileAsync = promisify(execFile);

const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';

const ALLOWED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'soundcloud.com',
  'twitch.tv',
  'dailymotion.com',
  'bilibili.com',
];

export function isUrlPermitted(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function sanitiseTitle(raw: string): string {
  return (raw || 'download')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
    || 'download';
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  if (!isUrlPermitted(url)) {
    throw new Error('URL domain is not on the permitted sources list');
  }

  try {
    const { stdout } = await execFileAsync(YTDLP_BIN, [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url,
    ], { timeout: 30000 });

    const data = JSON.parse(stdout);

    if (data.duration && data.duration > MAX_DURATION_SECONDS) {
      throw new Error(`Media duration exceeds maximum allowed (${MAX_DURATION_SECONDS}s)`);
    }

    const formats: UrlFormat[] = (data.formats || []).map((f: Record<string, unknown>) => ({
      formatId: String(f.format_id || ''),
      ext: String(f.ext || ''),
      resolution: f.resolution
        ? String(f.resolution)
        : f.height ? `${f.width}x${f.height}` : undefined,
      filesize: typeof f.filesize === 'number' ? f.filesize : undefined,
      label: String(f.format || f.format_id || ''),
    }));

    return {
      url,
      title: data.title,
      duration: data.duration,
      width: data.width,
      height: data.height,
      thumbnail: data.thumbnail,
      availableFormats: formats.filter(f => f.ext !== 'mhtml'),
    };
  } catch (err: any) {
    if (err.message?.includes('duration exceeds')) {
      throw err;
    }
    throw new Error(`Failed to fetch URL metadata: ${err.message}`);
  }
}

export interface DownloadResult {
  filePath: string;
  title: string;
  ext: string;
}

export async function downloadUrl(
  jobId: string,
  url: string,
  audioOnly = false,
  onProgress?: (progress: number) => void
): Promise<DownloadResult> {
  if (!isUrlPermitted(url)) {
    throw new Error('URL domain is not permitted');
  }

  let title = 'download';
  try {
    const { stdout } = await execFileAsync(YTDLP_BIN, [
      '--print', 'title',
      '--no-playlist',
      '--no-warnings',
      url,
    ], { timeout: 15000 });
    title = sanitiseTitle(stdout.trim());
  } catch {
    // Non-fatal — fall back to 'download'
  }

  const safeTitle = sanitiseTitle(title);
  const outTemplate = path.join(TEMP_DIR, `${jobId}_${safeTitle}.%(ext)s`);

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-part',
    '-o', outTemplate,
  ];

  if (audioOnly) {
    args.push('-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio');
  } else {
    args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
    args.push('--merge-output-format', 'mp4');
  }

  args.push(url);

  logger.info(`yt-dlp download start: ${url} (audioOnly=${audioOnly})`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.stdout?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line && line.includes('%')) {
        const match = line.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(Math.min(parseFloat(match[1]) * 0.3, 30));
        }
      }
      if (line) logger.info(`yt-dlp: ${line}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error(`yt-dlp exit ${code}: ${stderr.slice(-300)}`);
        reject(new Error(`yt-dlp failed (exit ${code}): ${stderr.slice(-200)}`));
      }
    });

    proc.on('error', (err) => reject(new Error(`yt-dlp spawn failed: ${err.message}`)));
  });

  const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(`${jobId}_`));
  if (!files.length) {
    throw new Error('yt-dlp completed but no output file found in temp dir');
  }

  const picked = files
    .map(f => ({ name: f, size: fs.statSync(path.join(TEMP_DIR, f)).size }))
    .sort((a, b) => b.size - a.size)[0];

  const filePath = path.join(TEMP_DIR, picked.name);
  const ext = path.extname(picked.name).slice(1);

  logger.info(`yt-dlp downloaded: ${filePath} (${picked.size} bytes)`);
  return { filePath, title: safeTitle, ext };
}