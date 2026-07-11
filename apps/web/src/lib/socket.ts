import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { getApiBaseUrl } from './api-url';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getApiBaseUrl().replace('/api/v1', '');
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
