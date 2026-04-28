import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_RPM } from '../utils/constants';

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_RPM * 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

export const convertRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_RPM,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Conversion rate limit exceeded' },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded' },
});

export const urlRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'URL fetch rate limit exceeded' },
});