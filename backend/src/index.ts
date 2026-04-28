import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';
import { globalRateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { convertRoutes } from './routes/convert';
import { statusRoutes } from './routes/status';
import { downloadRoutes } from './routes/download';
import { cleanupRoutes } from './routes/cleanup';
import { healthRoutes } from './routes/health';
import { registerWsHandlers, emitJobUpdate } from './services/websocket';
import { initializeQueue } from './services/queue';
import { startCleanupScheduler } from './services/cleanupWorker';
import { TEMP_DIR } from './utils/constants';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/ws',
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  logger.info(`Created temp directory: ${TEMP_DIR}`);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", FRONTEND_URL],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com'],
    },
  },
}));

app.use(cors({
  origin: [FRONTEND_URL, /localhost:\d+/],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(globalRateLimiter);

app.use('/api/health', healthRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/admin', cleanupRoutes);

app.use(errorHandler);

registerWsHandlers(io);

initializeQueue().then(() => {
  logger.info('Queue initialized successfully');
}).catch((err) => {
  logger.error('Failed to initialize queue', err);
});

startCleanupScheduler();

server.listen(PORT, () => {
  logger.info(`🚀 Transmux backend running on port ${PORT}`);
  logger.info(` Frontend: ${FRONTEND_URL}`);
  logger.info(` Temp dir: ${TEMP_DIR}`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { io, emitJobUpdate };