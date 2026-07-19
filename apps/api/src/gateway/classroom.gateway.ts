import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, LessonStatus } from '@mrh/types';
import { Lesson } from '../entities/lesson.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { RedisService } from '../redis/redis.service.js';
import {
  getClassroomSocketData,
  setClassroomSocketData,
} from '../common/types/classroom-socket.js';
import { ClassroomState } from './classroom-state.service.js';
import { WhiteboardService } from './classroom-whiteboard.service.js';
import { ChatService } from './classroom-chat.service.js';
import { WebrtcService } from './classroom-webrtc.service.js';
import { HealthService } from './classroom-health.service.js';

interface JwtHandshakePayload {
  sub: string;
  role: string;
  sessionId?: string;
  type?: 'access' | 'refresh';
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
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly state: ClassroomState,
    private readonly whiteboardService: WhiteboardService,
    private readonly chatService: ChatService,
    private readonly webrtcService: WebrtcService,
    private readonly healthService: HealthService,
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

      this.state.addClient(userId, { socketId: socket.id, userId, role });
      setClassroomSocketData(socket, {
        userId,
        role,
        currentLesson: null,
      });
      this.healthService.ensureHealthInterval();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const { userId } = getClassroomSocketData(socket);
    if (!userId) return;
    this.state.removeClient(userId, socket.id);
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
      lesson.studentId !== getClassroomSocketData(socket).userId &&
      lesson.tutorId !== getClassroomSocketData(socket).userId &&
      getClassroomSocketData(socket).role !== 'admin'
    ) {
      socket.emit('error_message', 'You are not a participant of this lesson');
      return;
    }

    socket.join(lessonId);
    setClassroomSocketData(socket, { currentLesson: lessonId });

    const whiteboardState = await this.whiteboardService.loadWhiteboard(lessonId);
    if (whiteboardState) {
      socket.emit('whiteboard_sync', JSON.parse(whiteboardState));
    }

    const bookState = await this.whiteboardService.loadBook(lessonId);
    if (bookState) {
      try {
        socket.emit('book_sync', JSON.parse(bookState));
      } catch {
        // ignore invalid book state
      }
    }

    socket.to(lessonId).emit('peer_joined', {
      userId: getClassroomSocketData(socket).userId,
      role: getClassroomSocketData(socket).role,
    });
  }

  @SubscribeMessage('send_chat')
  handleSendChat(
    socket: Socket,
    payload: { lessonId: string; content: string },
  ) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    this.chatService.handleSendChat(this.server, socket, payload);
  }

  @SubscribeMessage('canvas_draw')
  async handleCanvasDraw(
    socket: Socket,
    payload: { lessonId: string; page: number; data: unknown },
  ) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleCanvasDraw(this.server, socket, payload);
  }

  @SubscribeMessage('whiteboard_sync')
  async handleWhiteboardSync(socket: Socket, payload: { lessonId: string }) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleWhiteboardSync(this.server, socket, payload);
  }

  @SubscribeMessage('whiteboard_page_change')
  async handleWhiteboardPageChange(
    socket: Socket,
    payload: { lessonId: string; page: number },
  ) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleWhiteboardPageChange(this.server, socket, payload);
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
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleBookPresent(this.server, socket, payload);
  }

  @SubscribeMessage('book_page_change')
  async handleBookPageChange(
    socket: Socket,
    payload: { lessonId: string; page: number },
  ) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleBookPageChange(this.server, socket, payload);
  }

  @SubscribeMessage('book_close')
  async handleBookClose(socket: Socket, payload: { lessonId: string }) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    await this.whiteboardService.handleBookClose(this.server, socket, payload);
  }

  @SubscribeMessage('webrtc_offer')
  handleWebrtcOffer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ) {
    this.webrtcService.handleOffer(this.server, socket, 'webrtc_offer', payload);
  }

  @SubscribeMessage('webrtc_answer')
  handleWebrtcAnswer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; answer: unknown },
  ) {
    this.webrtcService.handleAnswer(this.server, socket, 'webrtc_answer', payload);
  }

  @SubscribeMessage('webrtc_ice_candidate')
  handleWebrtcIceCandidate(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; candidate: unknown },
  ) {
    this.webrtcService.handleIceCandidate(this.server, socket, 'webrtc_ice_candidate', payload);
  }

  @SubscribeMessage('webrtc_end')
  handleWebrtcEnd(socket: Socket, payload: { lessonId: string }) {
    this.webrtcService.handleEnd(this.server, socket, 'webrtc_end', payload);
  }

  @SubscribeMessage('camera_offer')
  handleCameraOffer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ) {
    this.webrtcService.handleOffer(this.server, socket, 'camera_offer', payload);
  }

  @SubscribeMessage('camera_answer')
  handleCameraAnswer(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; answer: unknown },
  ) {
    this.webrtcService.handleAnswer(this.server, socket, 'camera_answer', payload);
  }

  @SubscribeMessage('camera_ice_candidate')
  handleCameraIceCandidate(
    socket: Socket,
    payload: { lessonId: string; targetUserId: string; candidate: unknown },
  ) {
    this.webrtcService.handleIceCandidate(this.server, socket, 'camera_ice_candidate', payload);
  }

  @SubscribeMessage('camera_ready')
  handleCameraReady(socket: Socket, payload: { lessonId: string }) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    this.webrtcService.handleCameraReady(this.server, socket, payload);
  }

  @SubscribeMessage('ping_health')
  handlePingHealth(socket: Socket, payload: { timestamp: number }) {
    this.healthService.handlePingHealth(socket, payload);
  }

  @SubscribeMessage('health_report')
  handleHealthReport(
    socket: Socket,
    payload: { lessonId: string; rtt: number },
  ) {
    if (!this.assertLessonMembership(socket, payload.lessonId)) return;
    this.healthService.handleHealthReport(this.server, socket, payload);
  }

  @SubscribeMessage('leave_lesson')
  handleLeaveLesson(socket: Socket, payload: { lessonId: string }) {
    const { lessonId } = payload;
    if (!this.assertLessonMembership(socket, lessonId)) return;
    this.state.healthRecords.delete(socket.id);
    socket.to(lessonId).emit('peer_left', {
      userId: getClassroomSocketData(socket).userId,
    });
    socket.leave(lessonId);
    setClassroomSocketData(socket, { currentLesson: null });
  }

  private assertLessonMembership(socket: Socket, lessonId: string): boolean {
    return getClassroomSocketData(socket).currentLesson === lessonId;
  }
}
