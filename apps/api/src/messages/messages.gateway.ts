import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
  type?: string;
}

const socketData = new WeakMap<Socket, { userId: string; role: string }>();

function setMessageSocketData(
  socket: Socket,
  data: { userId: string; role: string },
) {
  socketData.set(socket, data);
}

function getMessageSocketData(socket: Socket) {
  return socketData.get(socket) ?? { userId: '', role: '' };
}

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        String(token),
      );

      if (payload.type && payload.type !== 'access') {
        socket.disconnect(true);
        return;
      }

      const userId = payload.sub;
      const role = payload.role;

      setMessageSocketData(socket, { userId, role });

      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const { userId } = getMessageSocketData(socket);
    if (!userId) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    socket: Socket,
    payload: { receiverId: string; content: string },
  ) {
    const { userId } = getMessageSocketData(socket);
    if (!userId) return;

    try {
      const message = await this.messagesService.sendMessage(userId, {
        receiverId: payload.receiverId,
        content: payload.content,
      });

      this.server.to(`user:${payload.receiverId}`).emit('new_message', message);
      socket.emit('new_message', message);
    } catch {
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  isUserOnline(userId: string): boolean {
    return (
      this.connectedUsers.has(userId) &&
      this.connectedUsers.get(userId)!.size > 0
    );
  }
}
