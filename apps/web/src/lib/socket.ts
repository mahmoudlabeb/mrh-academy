import { io, Socket } from "socket.io-client";
import { getApiOriginUrl } from "./api-url";

let socket: Socket | null = null;

function getSocketBaseUrl(): string {
  return getApiOriginUrl();
}

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getSocketBaseUrl();
    socket = io(`${baseUrl}/classroom`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
