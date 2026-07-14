import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

let socket: Socket | null = null;

function getSocketBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!apiUrl) return 'http://localhost:4000';
  return apiUrl.replace(/\/api\/v1$/, '');
}

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getSocketBaseUrl();
    socket = io(`${baseUrl}/classroom`, {
      auth: (cb: (params: { token: string }) => void) => {
        cb({ token: Cookies.get('mrh_token') || '' });
      },
      transports: ['websocket', 'polling'],
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
