import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  Injectable,
  BadRequestException,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity.js';
import { RedisService } from '../redis/redis.service.js';

interface ConnectedClient {
  socketId: string;
  userId: string;
  role: string;
}

interface HealthRecord {
  userId: string;
  socketId: string;
  rtt: number;
  lastSeen: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/classroom',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ClassroomGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
  private static readonly MAX_ACTIONS_PER_PAGE = 2000;
  private static readonly MAX_CHAT_PER_MINUTE = 30;
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, ConnectedClient[]>();
  private healthRecords = new Map<string, HealthRecord>();
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private chatRateLimits = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
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

      const payload = await this.jwtService.verifyAsync(token);
      const { sub: userId, role } = payload;

      const existing = this.connectedClients.get(userId) || [];
      existing.push({ socketId: socket.id, userId, role });
      this.connectedClients.set(userId, existing);

      socket.data.userId = userId;
      socket.data.role = role;
      this.ensureHealthInterval();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    if (!userId) return;

    const clients = this.connectedClients.get(userId) || [];
    const filtered = clients.filter((c) => c.socketId !== socket.id);
    if (filtered.length === 0) {
      this.connectedClients.delete(userId);
    } else {
      this.connectedClients.set(userId, filtered);
    }
  }

  @SubscribeMessage('join_lesson')
  async handleJoinLesson(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;

    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      select: { id: true, studentId: true, tutorId: true },
    });
    if (!lesson) {
      socket.emit('error_message', 'Lesson not found');
      return;
    }
    if (
      lesson.studentId !== socket.data.userId &&
      lesson.tutorId !== socket.data.userId &&
      socket.data.role !== 'admin'
    ) {
      socket.emit('error_message', 'You are not a participant of this lesson');
      return;
    }

    socket.join(lessonId);

    socket.data.currentLesson = lessonId;

    const whiteboardKey = `whiteboard:${lessonId}`;
    let whiteboardState = await this.redisService.get(whiteboardKey);
    if (!whiteboardState) {
      whiteboardState = JSON.stringify({ pages: { '1': [] }, currentPage: 1 });
      await this.redisService.set(whiteboardKey, whiteboardState, 'EX', 86400);
    }

    socket.emit('whiteboard_sync', JSON.parse(whiteboardState));

    socket.to(lessonId).emit('peer_joined', {
      userId: socket.data.userId,
      role: socket.data.role,
    });
  }

  onApplicationShutdown() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  private assertLessonMembership(socket: Socket, lessonId: string): boolean {
    return socket.data.currentLesson === lessonId;
  }

  private checkChatRateLimit(socketId: string): boolean {
    const now = Date.now();
    const record = this.chatRateLimits.get(socketId);
    if (!record || now > record.resetAt) {
      this.chatRateLimits.set(socketId, { count: 1, resetAt: now + 60000 });
      return true;
    }
    if (record.count >= ClassroomGateway.MAX_CHAT_PER_MINUTE) return false;
    record.count++;
    return true;
  }

  @SubscribeMessage('send_chat')
  handleSendChat(
    socket: Socket,
    payload: { lessonId: string; content: string },
  ) {
    const { lessonId, content } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    if (!this.checkChatRateLimit(socket.id)) return;
    if (!content || typeof content !== 'string') return;
    if (content.length > 2000) return;

    const sanitized = content
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim();
    if (!sanitized) return;

    this.server.to(lessonId).emit('chat_message', {
      senderId: socket.data.userId,
      content: sanitized,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('canvas_draw')
  async handleCanvasDraw(
    socket: Socket,
    payload: { lessonId: string; page: number; data: unknown },
  ) {
    const { lessonId, page, data } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    socket.to(lessonId).emit('canvas_update', {
      userId: socket.data.userId,
      page,
      data,
    });

    const whiteboardKey = `whiteboard:${lessonId}`;
    const existing = await this.redisService.get(whiteboardKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        const pageStr = String(page);
        if (!parsed.pages[pageStr]) {
          parsed.pages[pageStr] = [];
        }
        if (
          parsed.pages[pageStr].length < ClassroomGateway.MAX_ACTIONS_PER_PAGE
        ) {
          parsed.pages[pageStr].push(data);
        }
        await this.redisService.set(
          whiteboardKey,
          JSON.stringify(parsed),
          'EX',
          86400,
        );
      } catch {
        // ignore parse errors
      }
    }
  }

  @SubscribeMessage('whiteboard_sync')
  async handleWhiteboardSync(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    const whiteboardKey = `whiteboard:${lessonId}`;
    const state = await this.redisService.get(whiteboardKey);
    if (state) {
      socket.emit('whiteboard_sync', JSON.parse(state));
    }
  }

  @SubscribeMessage('whiteboard_page_change')
  async handleWhiteboardPageChange(
    socket: Socket,
    payload: { lessonId: string; page: number },
  ) {
    const { lessonId, page } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    const whiteboardKey = `whiteboard:${lessonId}`;
    const existing = await this.redisService.get(whiteboardKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        parsed.currentPage = page;
        await this.redisService.set(
          whiteboardKey,
          JSON.stringify(parsed),
          'EX',
          86400,
        );
      } catch {
        // ignore
      }
    }

    socket.to(lessonId).emit('whiteboard_page_change', { page });
  }

  private isInSameLesson(userId1: string, userId2: string): boolean {
    const clients1 = this.connectedClients.get(userId1);
    const clients2 = this.connectedClients.get(userId2);
    if (!clients1 || !clients2) return false;

    for (const c1 of clients1) {
      const socket1 = this.server.sockets.sockets.get(c1.socketId);
      if (!socket1) continue;
      for (const c2 of clients2) {
        const socket2 = this.server.sockets.sockets.get(c2.socketId);
        if (!socket2) continue;
        for (const room1 of socket1.rooms) {
          if (room1 === socket1.id) continue;
          for (const room2 of socket2.rooms) {
            if (room2 === socket2.id) continue;
            if (room1 === room2) return true;
          }
        }
      }
    }
    return false;
  }

  @SubscribeMessage('webrtc_offer')
  handleWebrtcOffer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ) {
    const { lessonId, targetUserId, offer } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_offer', {
          userId: socket.data.userId,
          offer,
        });
      }
    }
  }

  @SubscribeMessage('webrtc_answer')
  handleWebrtcAnswer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; answer: unknown },
  ) {
    const { lessonId, targetUserId, answer } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_answer', {
          userId: socket.data.userId,
          answer,
        });
      }
    }
  }

  @SubscribeMessage('webrtc_ice_candidate')
  handleWebrtcIceCandidate(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; candidate: unknown },
  ) {
    const { lessonId, targetUserId, candidate } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_ice_candidate', {
          userId: socket.data.userId,
          candidate,
        });
      }
    }
  }

  @SubscribeMessage('webrtc_end')
  handleWebrtcEnd(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    socket.to(lessonId).emit('webrtc_end', {
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('camera_offer')
  handleCameraOffer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ) {
    const { lessonId, targetUserId, offer } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_offer', {
          userId: socket.data.userId,
          offer,
        });
      }
    }
  }

  @SubscribeMessage('camera_answer')
  handleCameraAnswer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; answer: unknown },
  ) {
    const { lessonId, targetUserId, answer } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_answer', {
          userId: socket.data.userId,
          answer,
        });
      }
    }
  }

  @SubscribeMessage('camera_ice_candidate')
  handleCameraIceCandidate(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; candidate: unknown },
  ) {
    const { lessonId, targetUserId, candidate } = payload;
    if (socket.data.currentLesson !== lessonId) return;
    if (!this.isInSameLesson(socket.data.userId, targetUserId)) return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_ice_candidate', {
          userId: socket.data.userId,
          candidate,
        });
      }
    }
  }

  @SubscribeMessage('camera_ready')
  handleCameraReady(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    socket.to(lessonId).emit('camera_ready', {
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('ping_health')
  handlePingHealth(socket: Socket, payload: { timestamp: number }) {
    socket.emit('pong_health', {
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    });
  }

  @SubscribeMessage('health_report')
  handleHealthReport(
    socket: Socket,
    payload: { lessonId: string; rtt: number },
  ) {
    const { lessonId, rtt } = payload;
    const userId = socket.data.userId;
    if (!userId || !lessonId) return;

    this.healthRecords.set(socket.id, {
      userId,
      socketId: socket.id,
      rtt,
      lastSeen: Date.now(),
    });

    const roomHealth = Array.from(this.healthRecords.values())
      .filter((r) => {
        const sock = this.server.sockets.sockets.get(r.socketId);
        return sock && sock.rooms.has(lessonId);
      })
      .map((r) => ({ userId: r.userId, rtt: r.rtt }));

    this.server
      .to(lessonId)
      .emit('connection_health', { participants: roomHealth });
  }

  private ensureHealthInterval() {
    if (this.healthInterval) return;
    this.healthInterval = setInterval(() => {
      const now = Date.now();
      for (const [socketId, record] of this.healthRecords) {
        if (now - record.lastSeen > 15000) {
          this.healthRecords.delete(socketId);
        }
      }
    }, 10000);
  }

  @SubscribeMessage('leave_lesson')
  handleLeaveLesson(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    this.healthRecords.delete(socket.id);
    socket.to(lessonId).emit('peer_left', {
      userId: socket.data.userId,
    });
    socket.leave(lessonId);
    socket.data.currentLesson = null;
  }
}
