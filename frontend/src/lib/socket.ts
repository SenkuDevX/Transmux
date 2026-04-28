'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ActiveJob, ConversionStatus } from './api';

interface JobProgressEvent {
  jobId: string;
  progress: number;
  status: ConversionStatus;
}

interface JobCompleteEvent {
  jobId: string;
  downloadUrl: string;
  expiresAt: string;
}

interface JobFailedEvent {
  jobId: string;
  error: string;
}

interface ExpiredEvent {
  jobId: string;
}

type WebSocketEvent = JobProgressEvent | JobCompleteEvent | JobFailedEvent | ExpiredEvent;

interface UseWebSocketOptions {
  onProgress?: (data: JobProgressEvent) => void;
  onComplete?: (data: JobCompleteEvent) => void;
  onFailed?: (data: JobFailedEvent) => void;
  onExpired?: (data: ExpiredEvent) => void;
}

export function useWebSocket(jobId: string | null, options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (!jobId) return;
    if (socketRef.current?.connected) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || '';

    if (!wsUrl) return;

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('subscribe', jobId);
    });

    socket.on('job-progress', (data: JobProgressEvent) => {
      if (data.jobId === jobId) {
        optionsRef.current.onProgress?.(data);
      }
    });

    socket.on('job-complete', (data: JobCompleteEvent) => {
      if (data.jobId === jobId) {
        optionsRef.current.onComplete?.(data);
      }
    });

    socket.on('job-failed', (data: JobFailedEvent) => {
      if (data.jobId === jobId) {
        optionsRef.current.onFailed?.(data);
      }
    });

    socket.on('expired', (data: ExpiredEvent) => {
      if (data.jobId === jobId) {
        optionsRef.current.onExpired?.(data);
      }
    });

    socket.on('disconnect', () => {});
    socket.on('error', () => {});

    socketRef.current = socket;
  }, [jobId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { disconnect, reconnect: connect };
}

export function useJobsWebSocket(onEvent: (event: string, data: WebSocketEvent) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || '';
    if (!wsUrl) return;

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('job-progress', (data) => onEvent('progress', data));
    socket.on('job-complete', (data) => onEvent('complete', data));
    socket.on('job-failed', (data) => onEvent('failed', data));
    socket.on('expired', (data) => onEvent('expired', data));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [onEvent]);

  return socketRef;
}