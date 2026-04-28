import { Request, Response, NextFunction } from 'express';
import { isUrlPermitted, sanitiseTitle } from '../services/ytdlp';
import { logger } from '../utils/logger';

export function validateUrlInput(req: Request, res: Response, next: NextFunction): void {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'URL must use HTTP or HTTPS protocol' });
      return;
    }

    const hostname = parsedUrl.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      res.status(400).json({ error: 'Localhost URLs are not permitted' });
      return;
    }

    const privateIpPatterns = [
      /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
      /^localhost$/, /^0\.0\.0\.0$/, /^127\./,
    ];
    if (privateIpPatterns.some(p => p.test(hostname))) {
      res.status(400).json({ error: 'Private IP addresses are not permitted' });
      return;
    }

  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  next();
}

export function blockDangerousPaths(req: Request, res: Response, next: NextFunction): void {
  const dangerousPatterns = [
    /\.\./,
    /\/%2e%2e/gi,
    /\.\.%2f/gi,
    /%2e%2e\//gi,
  ];

  const pathToCheck = req.path + req.url;
  if (dangerousPatterns.some(p => p.test(pathToCheck))) {
    logger.warn(`Blocked dangerous path attempt: ${pathToCheck}`);
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  next();
}

export function validateJobId(req: Request, res: Response, next: NextFunction): void {
  const { jobId } = req.params;

  if (!jobId || jobId.length < 5 || jobId.length > 100) {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  const validUuidPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validUuidPattern.test(jobId)) {
    res.status(400).json({ error: 'Invalid job ID format' });
    return;
  }

  next();
}