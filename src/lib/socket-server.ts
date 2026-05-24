import { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server | null = null;

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
      socket.join(`job:${jobId}`);
    });

    socket.on("unsubscribe:job", (jobId: string) => {
      socket.leave(`job:${jobId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitJobUpdate(jobId: string, data: any) {
  io?.to(`job:${jobId}`).emit("job:update", { jobId, ...data });
}

export function emitJobProgress(jobId: string, progress: number, eta?: string) {
  io?.to(`job:${jobId}`).emit("job:progress", { jobId, progress, eta });
}

export function emitJobComplete(jobId: string, result: any) {
  io?.to(`job:${jobId}`).emit("job:complete", { jobId, ...result });
}

export function emitJobError(jobId: string, error: string) {
  io?.to(`job:${jobId}`).emit("job:error", { jobId, error });
}

export function emitThumbnailProgress(jobId: string, current: number, total: number) {
  io?.to(`job:${jobId}`).emit("thumbnail:progress", { jobId, current, total });
}

export function getIO() {
  return io;
}
