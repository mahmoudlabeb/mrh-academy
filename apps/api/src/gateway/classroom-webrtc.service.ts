import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@mrh/types';
import { getClassroomSocketData } from '../common/types/classroom-socket.js';
import { ClassroomState } from './classroom-state.service.js';

@Injectable()
export class WebrtcService {
  constructor(private readonly state: ClassroomState) {}

  handleOffer(
    server: Server,
    socket: Socket,
    eventName: string,
    payload: { lessonId: string; targetUserId: string; offer: unknown },
  ): void {
    const { lessonId, targetUserId, offer } = payload;
    if (!this.isMember(socket, lessonId)) return;
    if (!this.state.isInSameLesson(
      getClassroomSocketData(socket).userId,
      targetUserId,
      server.sockets.sockets,
    )) return;

    this.forwardToUser(server, targetUserId, eventName, {
      userId: getClassroomSocketData(socket).userId,
      offer,
    });
  }

  handleAnswer(
    server: Server,
    socket: Socket,
    eventName: string,
    payload: { lessonId: string; targetUserId: string; answer: unknown },
  ): void {
    const { lessonId, targetUserId, answer } = payload;
    if (!this.isMember(socket, lessonId)) return;
    if (!this.state.isInSameLesson(
      getClassroomSocketData(socket).userId,
      targetUserId,
      server.sockets.sockets,
    )) return;

    this.forwardToUser(server, targetUserId, eventName, {
      userId: getClassroomSocketData(socket).userId,
      answer,
    });
  }

  handleIceCandidate(
    server: Server,
    socket: Socket,
    eventName: string,
    payload: { lessonId: string; targetUserId: string; candidate: unknown },
  ): void {
    const { lessonId, targetUserId, candidate } = payload;
    if (!this.isMember(socket, lessonId)) return;
    if (!this.state.isInSameLesson(
      getClassroomSocketData(socket).userId,
      targetUserId,
      server.sockets.sockets,
    )) return;

    this.forwardToUser(server, targetUserId, eventName, {
      userId: getClassroomSocketData(socket).userId,
      candidate,
    });
  }

  handleEnd(
    server: Server,
    socket: Socket,
    eventName: string,
    payload: { lessonId: string },
  ): void {
    const { lessonId } = payload;
    socket.to(lessonId).emit(eventName, {
      userId: getClassroomSocketData(socket).userId,
    });
  }

  handleCameraReady(
    server: Server,
    socket: Socket,
    payload: { lessonId: string },
  ): void {
    const { lessonId } = payload;
    socket.to(lessonId).emit('camera_ready', {
      userId: getClassroomSocketData(socket).userId,
    });
  }

  private forwardToUser(
    server: Server,
    targetUserId: string,
    eventName: string,
    data: Record<string, unknown>,
  ): void {
    const clients = this.state.connectedClients.get(targetUserId);
    if (clients) {
      for (const client of clients) {
        server.to(client.socketId).emit(eventName, data);
      }
    }
  }

  private isMember(socket: Socket, lessonId: string): boolean {
    return getClassroomSocketData(socket).currentLesson === lessonId;
  }
}
