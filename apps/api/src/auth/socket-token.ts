import type { Socket } from 'socket.io';

export function getSocketAccessToken(socket: Socket): string | undefined {
  const cookieHeader = socket.handshake.headers.cookie;
  const cookie = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('mrh_token='));
  if (cookie) return decodeURIComponent(cookie.slice('mrh_token='.length));
  return undefined;
}
