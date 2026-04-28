import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const healthRoutes = Router();
const exec = promisify(execFile);

healthRoutes.get('/', async (_req: Request, res: Response) => {
  let ffmpeg = false;
  let ytdlp = false;

  try {
    await exec('ffmpeg', ['-version']);
    ffmpeg = true;
  } catch {}

  try {
    await exec('yt-dlp', ['--version']);
    ytdlp = true;
  } catch {}

  res.json({
    status: 'ok',
    ffmpeg,
    ytdlp,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});