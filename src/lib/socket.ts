import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (socket?.connected) return socket;
  try {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: false,
    });
    return socket;
  } catch {
    console.warn("[Socket.IO] Failed to connect");
    return null;
  }
}

export function connectSocket(token?: string) {
  const s = getSocket();
  if (!s) return null;
  if (token) s.auth = { token };
  s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
