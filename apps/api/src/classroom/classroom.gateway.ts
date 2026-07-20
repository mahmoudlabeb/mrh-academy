import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import sanitizeHtml from 'sanitize-html';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, LessonStatus } from '@mrh/types';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Classroom } from './entities/classroom.entity.js';
import { User } from '../users/entities/user.entity.js';
import { RedisService } from '../redis/redis.service.js';
import {
  getClassroomSocketData,
  setClassroomSocketData,
} from '../common/types/classroom-socket.js';
import { websocketCors } from '../config/websocket.config.js';

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

interface JwtHandshakePayload {
  sub: string;
  role: string;
  sessionId?: string;
  type?: 'access' | 'refresh';
}

@Injectable()
@WebSocketGateway({
  namespace: '/classroom',
  cors: websocketCors,
})
export class ClassroomGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
  private static readonly MAX_ACTIONS_PER_PAGE = 2000;
  private static readonly MAX_WHITEBOARD_PAGES = 50;
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

  private async persistWhiteboardToDb(
    lessonId: string,
    state: object,
  ): Promise<void> {
    try {
      await this.classroomRepository.update(
        { lessonId },
        { whiteboardSnapshot: state },
      );
    } catch {
      // Ignore DB errors - Redis is source of truth for real-time
    }
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

      const payload = await this.jwtService.verifyAsync<JwtHandshakePayload>(
        String(token),
      );

      if (payload.type && payload.type !== 'access') {
        socket.disconnect(true);
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        socket.disconnect(true);
        return;
      }

      if (user.role === UserRole.STUDENT && payload.sessionId) {
        const activeSession = await this.redisService.get(
          `user_session:${user.id}`,
        );
        if (activeSession !== payload.sessionId) {
          socket.disconnect(true);
          return;
        }
      }

      const userId = user.id;
      const role = user.role;

      const existing = this.connectedClients.get(userId) || [];
      existing.push({ socketId: socket.id, userId, role });
      this.connectedClients.set(userId, existing);

      setClassroomSocketData(socket, {
        userId,
        role,
        currentLesson: null,
      });
      this.ensureHealthInterval();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const { userId } = getClassroomSocketData(socket);
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
      select: { id: true, studentId: true, tutorId: true, status: true },
    });
    if (!lesson) {
      socket.emit('error_message', 'Lesson not found');
      return;
    }
    if (
      lesson.status === LessonStatus.COMPLETED ||
      lesson.status === LessonStatus.CANCELLED
    ) {
      socket.emit('error_message', 'This lesson is no longer available');
      return;
    }
    const classroom = await this.classroomRepository.findOne({
      where: { lessonId },
      select: ['whiteboardSnapshot', 'isActive'],
    });
    if (classroom && !classroom.isActive) {
      socket.emit('error_message', 'Classroom is closed');
      return;
    }
    if (
      lesson.studentId !== this.socketData(socket).userId &&
      lesson.tutorId !== this.socketData(socket).userId &&
      this.socketData(socket).role !== 'admin'
    ) {
      socket.emit('error_message', 'You are not a participant of this lesson');
      return;
    }

    socket.join(lessonId);

    setClassroomSocketData(socket, { currentLesson: lessonId });

    const whiteboardKey = `whiteboard:${lessonId}`;
    let whiteboardState = await this.redisService.get(whiteboardKey);
    if (!whiteboardState) {
      // Fallback to DB if Redis is empty
      const classroom = await this.classroomRepository.findOne({
        where: { lessonId },
        select: ['whiteboardSnapshot'],
      });
      if (classroom?.whiteboardSnapshot) {
        whiteboardState = JSON.stringify(classroom.whiteboardSnapshot);
      } else {
        whiteboardState = JSON.stringify({
          pages: { '1': [] },
          currentPage: 1,
        });
      }
      await this.redisService.set(whiteboardKey, whiteboardState, 'EX', 86400);
    }

    socket.emit('whiteboard_sync', JSON.parse(whiteboardState));

    const bookKey = `book:${lessonId}`;
    const bookState = await this.redisService.get(bookKey);
    if (bookState) {
      try {
        socket.emit('book_sync', JSON.parse(bookState));
      } catch {
        // ignore invalid book state
      }
    }

    socket.to(lessonId).emit('peer_joined', {
      userId: this.socketData(socket).userId,
      role: this.socketData(socket).role,
    });
  }

  onApplicationShutdown() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  private socketData(socket: Socket) {
    return getClassroomSocketData(socket);
  }

  private assertLessonMembership(socket: Socket, lessonId: string): boolean {
    return getClassroomSocketData(socket).currentLesson === lessonId;
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

    const sanitized = sanitizeHtml(content, {
      allowedTags: [], // Strip all tags in realtime chat
      allowedAttributes: {},
    }).trim();
    if (!sanitized) return;

    this.server.to(lessonId).emit('chat_message', {
      senderId: this.socketData(socket).userId,
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
      userId: this.socketData(socket).userId,
      page,
      data,
    });

    const whiteboardKey = `whiteboard:${lessonId}`;
    const existing = await this.redisService.get(whiteboardKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        const pageStr = String(page);
        if (
          !parsed.pages[pageStr] &&
          Object.keys(parsed.pages).length >=
            ClassroomGateway.MAX_WHITEBOARD_PAGES
        ) {
          return;
        }
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
        await this.persistWhiteboardToDb(lessonId, parsed);
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
        await this.persistWhiteboardToDb(lessonId, parsed);
      } catch {
        // ignore
      }
    }

    socket.to(lessonId).emit('whiteboard_page_change', { page });
  }

  @SubscribeMessage('book_present')
  async handleBookPresent(
    socket: Socket,
    payload: {
      lessonId: string;
      bookId: string;
      title: string;
      pageCount: number;
      page?: number;
    },
  ) {
    if (this.socketData(socket).role !== UserRole.TUTOR.toString()) return;
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    if (!payload.bookId || !payload.title || !payload.pageCount) return;

    const page = Math.max(1, Math.min(payload.page ?? 1, payload.pageCount));
    const state = {
      active: true,
      bookId: payload.bookId,
      title: payload.title,
      pageCount: payload.pageCount,
      page,
    };

    const bookKey = `book:${payload.lessonId}`;
    await this.redisService.set(bookKey, JSON.stringify(state), 'EX', 86400);
    this.server.to(payload.lessonId).emit('book_sync', state);
  }

  @SubscribeMessage('book_page_change')
  async handleBookPageChange(
    socket: Socket,
    payload: { lessonId: string; page: number },
  ) {
    if (this.socketData(socket).role !== UserRole.TUTOR.toString()) return;
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    if (!Number.isInteger(payload.page) || payload.page < 1) return;

    const bookKey = `book:${payload.lessonId}`;
    const existing = await this.redisService.get(bookKey);
    if (!existing) return;

    try {
      const parsed = JSON.parse(existing) as {
        active: boolean;
        bookId: string;
        title: string;
        pageCount: number;
        page: number;
      };
      const page = Math.min(payload.page, parsed.pageCount);
      parsed.page = page;
      await this.redisService.set(bookKey, JSON.stringify(parsed), 'EX', 86400);
      this.server.to(payload.lessonId).emit('book_page_change', { page });
    } catch {
      // ignore
    }
  }

  @SubscribeMessage('book_close')
  async handleBookClose(socket: Socket, payload: { lessonId: string }) {
    if (this.socketData(socket).role !== UserRole.TUTOR.toString()) return;
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;

    const bookKey = `book:${payload.lessonId}`;
    await this.redisService.del(bookKey);
    this.server.to(payload.lessonId).emit('book_close', {});
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
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_offer', {
          userId: this.socketData(socket).userId,
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
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_answer', {
          userId: this.socketData(socket).userId,
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
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('webrtc_ice_candidate', {
          userId: this.socketData(socket).userId,
          candidate,
        });
      }
    }
  }

  @SubscribeMessage('webrtc_end')
  handleWebrtcEnd(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    socket.to(lessonId).emit('webrtc_end', {
      userId: this.socketData(socket).userId,
    });
  }

  @SubscribeMessage('camera_offer')
  handleCameraOffer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ) {
    const { lessonId, targetUserId, offer } = payload;
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_offer', {
          userId: this.socketData(socket).userId,
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
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_answer', {
          userId: this.socketData(socket).userId,
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
    if (this.socketData(socket).currentLesson !== lessonId) return;
    if (!this.isInSameLesson(this.socketData(socket).userId, targetUserId))
      return;
    const targetClients = this.connectedClients.get(targetUserId);
    if (targetClients) {
      for (const client of targetClients) {
        this.server.to(client.socketId).emit('camera_ice_candidate', {
          userId: this.socketData(socket).userId,
          candidate,
        });
      }
    }
  }

  @SubscribeMessage('camera_ready')
  handleCameraReady(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    socket.to(lessonId).emit('camera_ready', {
      userId: this.socketData(socket).userId,
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
    if (!this.assertLessonMembership(socket, lessonId)) return;
    const userId = this.socketData(socket).userId;
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
    if (!this.assertLessonMembership(socket, lessonId)) return;
    this.healthRecords.delete(socket.id);
    socket.to(lessonId).emit('peer_left', {
      userId: this.socketData(socket).userId,
    });
    socket.leave(lessonId);
    setClassroomSocketData(socket, { currentLesson: null });
  }
}
