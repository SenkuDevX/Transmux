import { io, Socket, Manager } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;

let socket: Socket | null = null;

// Event map constants for type-safe event names and better DX
export const SOCKET_EVENTS = {
  // Job lifecycle
  JOB_UPDATE: "job:update",
  JOB_PROGRESS: "job:progress",
  JOB_COMPLETE: "job:complete",
  JOB_ERROR: "job:error",

  // Thumbnail generation
  THUMBNAIL_PROGRESS: "thumbnail:progress",

  // Subscriptions
  SUBSCRIBE_JOB: "subscribe:job",
  UNSUBSCRIBE_JOB: "unsubscribe:job",
} as const;

// Type-safe event payload definitions
export interface JobUpdatePayload {
  jobId: string;
  status: string;
  [key: string]: unknown;
}

export interface JobProgressPayload {
  jobId: string;
  progress: number;
  eta?: string;
}

export interface JobCompletePayload {
  jobId: string;
  [key: string]: unknown;
}

export interface JobErrorPayload {
  jobId: string;
  error: string;
}

export interface ThumbnailProgressPayload {
  jobId: string;
  current: number;
  total: number;
}

/**
 * Get the global Socket.IO client instance.
 * Returns the cached socket if already connected; otherwise creates a new one.
 */
export function getSocket(): Socket | null {
  if (socket) return socket;

  try {
    socket = io(SOCKET_URL, {
      transports: [
        // NOTE: In local development, remove "websocket" and use "polling" alone
        // to avoid WDS (Webpack Dev Server) port issues. In production, you can
        // use "websocket" first.
        ...(import.meta.env.DEV ? ["polling"] : ["websocket", "polling"]),
      ],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000, // Increased to 20 seconds for larger files
      autoConnect: false,
    });

    // Set up core listeners once on creation
    setupBaseListeners(socket);

    return socket;
  } catch (err) {
    console.error("[Socket.IO] Failed to connect:", err);
    return null;
  }
}

// Track reconnect attempts for debugging / UX
let reconnectAttempt = 0;

/**
 * Attach base error, reconnect, and lifecycle listeners to a socket.
 * These run once per socket instance and log/debug state changes.
 */
function setupBaseListeners(s: Socket) {
  // Connection opened
  s.on("connect", () => {
    reconnectAttempt = 0;
    console.log(`[Socket.IO] Connected: ${s.id}`);
  });

  // Connection lost
  s.on("disconnect", (reason: string) => {
    console.warn(`[Socket.IO] Disconnected: ${reason}`);
  });

  // Reconnecting
  s.io.on("reconnect_attempt", (attempt: number) => {
    reconnectAttempt = attempt;
    console.warn(`[Socket.IO] Reconnecting... attempt #${attempt}`);
  });

  // Reconnect error
  s.io.on("reconnect_error", (error: Error) => {
    console.error(`[Socket.IO] Reconnect error:`, error);
  });

  // Reconnect failed after all attempts
  s.io.on("reconnect_failed", () => {
    console.error("[Socket.IO] Reconnect failed after max attempts");
  });

  // Generic error
  s.on("error", (error: Error) => {
    console.error(`[Socket.IO] Error:`, error);
  });
}

/**
 * Connect the global socket if it isn't already connected or connecting.
 * Optionally pass an auth token for server-side verification.
 */
export function connectSocket(token?: string): Socket | null {
  const s = getSocket();
  if (!s) return null;

  // Prevent redundant reconnection attempts on an active socket
  if (s.connected) {
    console.log("[Socket.IO] Already connected");
    return s;
  }
  if (s.active) {
    console.log("[Socket.IO] Already connecting");
    return s;
  }

  if (token) {
    (s as Socket & { auth: Record<string, string> }).auth = { token };
  }

  s.connect();
  return s;
}

/**
 * Safely disconnect the global socket.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    // Optionally remove all listeners so a future getSocket() starts fresh
    socket.removeAllListeners();
    socket = null;
  }
}

// Type-safe listener helpers for job events

/** Listen for job status updates. Returns an unsubscribe function. */
export function onJobUpdate(
  callback: (payload: JobUpdatePayload) => void
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (payload: JobUpdatePayload) => callback(payload);
  s.on(SOCKET_EVENTS.JOB_UPDATE, handler);

  return () => {
    s.off(SOCKET_EVENTS.JOB_UPDATE, handler);
  };
}

/** Listen for job progress events. Returns an unsubscribe function. */
export function onJobProgress(
  callback: (payload: JobProgressPayload) => void
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (payload: JobProgressPayload) => callback(payload);
  s.on(SOCKET_EVENTS.JOB_PROGRESS, handler);

  return () => {
    s.off(SOCKET_EVENTS.JOB_PROGRESS, handler);
  };
}

/** Listen for job completion events. Returns an unsubscribe function. */
export function onJobComplete(
  callback: (payload: JobCompletePayload) => void
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (payload: JobCompletePayload) => callback(payload);
  s.on(SOCKET_EVENTS.JOB_COMPLETE, handler);

  return () => {
    s.off(SOCKET_EVENTS.JOB_COMPLETE, handler);
  };
}

/** Listen for job error events. Returns an unsubscribe function. */
export function onJobError(
  callback: (payload: JobErrorPayload) => void
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (payload: JobErrorPayload) => callback(payload);
  s.on(SOCKET_EVENTS.JOB_ERROR, handler);

  return () => {
    s.off(SOCKET_EVENTS.JOB_ERROR, handler);
  };
}

/** Subscribe to a specific job room. */
export function subscribeToJob(jobId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit(SOCKET_EVENTS.SUBSCRIBE_JOB, jobId);
}

/** Unsubscribe from a specific job room. */
export function unsubscribeFromJob(jobId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit(SOCKET_EVENTS.UNSUBSCRIBE_JOB, jobId);
}
