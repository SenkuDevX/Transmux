import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

// In-memory room usage tracker for better debugging
const roomSizes = new Map<string, Set<string>>();

function trackJoin(socketId: string, room: string) {
  if (!roomSizes.has(room)) {
    roomSizes.set(room, new Set());
  }
  roomSizes.get(room)!.add(socketId);
}

function trackLeave(socketId: string, room: string) {
  const set = roomSizes.get(room);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      roomSizes.delete(room);
    }
  }
}

function logRoomSize(room: string) {
  const size = roomSizes.get(room)?.size ?? 0;
  console.log(`[Socket.IO] Room ${room} now has ${size} listener(s)`);
}

// Rate limiting / debounce state for progress events
const lastProgressEmit = new Map<string, number>();
const PROGRESS_DEBOUNCE_MS = 200; // only emit progress every 200ms per job

function canEmitProgress(jobId: string): boolean {
  const now = Date.now();
  const last = lastProgressEmit.get(jobId);
  if (!last || now - last > PROGRESS_DEBOUNCE_MS) {
    lastProgressEmit.set(jobId, now);
    return true;
  }
  return false;
}

// Simple authentication guard
function isAuthenticated(socket: Socket): boolean {
  // You can extend this to check socket.handshake.auth.token against your auth service
  const token = (socket.handshake.auth as { token?: string }).token;
  return typeof token === "string" && token.length > 0;
}

export function initSocketIO(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on("subscribe:job", (jobId: string) => {
      try {
        const room = `job:${jobId}`;
        socket.join(room);
        trackJoin(socket.id, room);
        logRoomSize(room);
      } catch (err) {
        console.error(`[Socket.IO] subscribe:job error for ${socket.id}:`, err);
      }
    });

    socket.on("unsubscribe:job", (jobId: string) => {
      try {
        const room = `job:${jobId}`;
        socket.leave(room);
        trackLeave(socket.id, room);
        logRoomSize(room);
      } catch (err) {
        console.error(`[Socket.IO] unsubscribe:job error for ${socket.id}:`, err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      // Clean up any dangling room references
      for (const [room, ids] of roomSizes.entries()) {
        if (ids.has(socket.id)) {
          ids.delete(socket.id);
          if (ids.size === 0) roomSizes.delete(room);
          logRoomSize(room);
        }
      }
    });
  });

  return io;
}

// Graceful null-check wrapper for emitting to a room
function safeEmit(room: string, event: string, payload: unknown) {
  if (!io) {
    console.warn(`[Socket.IO] Tried to emit "${event}" but server is not initialized`);
    return;
  }
  try {
    io.to(room).emit(event, payload);
  } catch (err) {
    console.error(`[Socket.IO] emit "${event}" error:`, err);
  }
}

export function emitJobUpdate(jobId: string, data: Record<string, unknown>) {
  safeEmit(`job:${jobId}`, "job:update", { jobId, ...data });
}

export function emitJobProgress(jobId: string, progress: number, eta?: string) {
  if (!canEmitProgress(jobId)) return;
  safeEmit(`job:${jobId}`, "job:progress", { jobId, progress, eta });
}

export function emitJobComplete(jobId: string, result: Record<string, unknown>) {
  safeEmit(`job:${jobId}`, "job:complete", { jobId, ...result });
}

export function emitJobError(jobId: string, error: string) {
  safeEmit(`job:${jobId}`, "job:error", { jobId, error });
}

export function emitThumbnailProgress(jobId: string, current: number, total: number) {
  safeEmit(`job:${jobId}`, "thumbnail:progress", { jobId, current, total });
}

export function getIO() {
  return io;
}
