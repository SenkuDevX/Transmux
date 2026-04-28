import { Server as SocketIOServer, Socket } from 'socket.io';
import type { ConversionJob, JobStatus } from '@transmux/shared';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

export function registerWsHandlers(server: SocketIOServer): void {
  io = server;

  io.on('connection', (socket: Socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    socket.on('subscribe', (jobId: string) => {
      socket.join(`job:${jobId}`);
      logger.info(`Client ${socket.id} subscribed to job ${jobId}`);
    });

    socket.on('unsubscribe', (jobId: string) => {
      socket.leave(`job:${jobId}`);
      logger.info(`Client ${socket.id} unsubscribed from job ${jobId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });

    socket.on('error', (err) => {
      logger.error(`WebSocket error for ${socket.id}`, err);
    });
  });

  logger.info('WebSocket handlers registered');
}

export function emitJobProgress(jobId: string, progress: number, status: JobStatus): void {
  if (!io) return;
  io.to(`job:${jobId}`).emit('job-progress', { jobId, progress, status });
}

export function emitJobComplete(jobId: string, downloadUrl: string, expiresAt: string): void {
  if (!io) return;
  io.to(`job:${jobId}`).emit('job-complete', { jobId, downloadUrl, expiresAt });
}

export function emitJobFailed(jobId: string, error: string): void {
  if (!io) return;
  io.to(`job:${jobId}`).emit('job-failed', { jobId, error });
}

export function emitJobExpired(jobId: string): void {
  if (!io) return;
  io.to(`job:${jobId}`).emit('expired', { jobId });
}

export function emitJobUpdate(job: ConversionJob): void {
  if (!io) return;
  io.to(`job:${job.id}`).emit('job-update', { type: 'job_update', job });
}

export function broadcastJob(job: ConversionJob): void {
  emitJobUpdate(job);
}

export function broadcastToAll(event: string, data: any): void {
  if (!io) return;
  io.emit(event, data);
}