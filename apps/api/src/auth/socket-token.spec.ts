import type { Socket } from 'socket.io';
import { getSocketAccessToken } from './socket-token.js';

const socketWithCookie = (cookie?: string) =>
  ({
    handshake: {
      headers: { cookie },
    },
  }) as Socket;

describe('getSocketAccessToken', () => {
  it('reads and decodes the secure access-token cookie', () => {
    const socket = socketWithCookie(
      'theme=dark; mrh_token=header.payload%2Bsignature; locale=ar',
    );

    expect(getSocketAccessToken(socket)).toBe('header.payload+signature');
  });

  it('does not accept unrelated cookies or query-string credentials', () => {
    const socket = socketWithCookie('theme=dark; locale=en');
    (socket.handshake as unknown as { query: Record<string, string> }).query = {
      token: 'unsafe-query-token',
    };

    expect(getSocketAccessToken(socket)).toBeUndefined();
  });
});
