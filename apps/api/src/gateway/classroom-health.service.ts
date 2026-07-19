import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { getClassroomSocketData } from '../common/types/classroom-socket.js';
import { ClassroomState } from './classroom-state.service.js';

@Injectable()
export class HealthService implements OnApplicationShutdown {
  constructor(private readonly state: ClassroomState) {}

  handlePingHealth(socket: Socket, payload: { timestamp: number }): void {
    socket.emit('pong_health', {
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    });
  }

  handleHealthReport(
    server: Server,
    socket: Socket,
    payload: { lessonId: string; rtt: number },
  ): void {
    const { lessonId, rtt } = payload;
    const userId = getClassroomSocketData(socket).userId;
    if (!userId || !lessonId) return;

    this.state.healthRecords.set(socket.id, {
      userId,
      socketId: socket.id,
      rtt,
      lastSeen: Date.now(),
    });

    const roomHealth = Array.from(this.state.healthRecords.values())
      .filter((r) => {
        const sock = server.sockets.sockets.get(r.socketId);
        return sock && sock.rooms.has(lessonId);
      })
      .map((r) => ({ userId: r.userId, rtt: r.rtt }));

    server
      .to(lessonId)
      .emit('connection_health', { participants: roomHealth });
  }

  ensureHealthInterval(): void {
    if (this.state.healthInterval) return;
    this.state.healthInterval = setInterval(() => {
      const now = Date.now();
      for (const [socketId, record] of this.state.healthRecords) {
        if (now - record.lastSeen > 15000) {
          this.state.healthRecords.delete(socketId);
        }
      }
    }, 10000);
  }

  onApplicationShutdown(): void {
    if (this.state.healthInterval) {
      clearInterval(this.state.healthInterval);
      this.state.healthInterval = null;
    }
  }
}
