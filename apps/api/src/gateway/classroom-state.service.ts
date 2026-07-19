import { Injectable } from '@nestjs/common';

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

interface ChatRateRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class ClassroomState {
  readonly connectedClients = new Map<string, ConnectedClient[]>();
  readonly healthRecords = new Map<string, HealthRecord>();
  readonly chatRateLimits = new Map<string, ChatRateRecord>();
  healthInterval: ReturnType<typeof setInterval> | null = null;

  addClient(userId: string, client: ConnectedClient): void {
    const existing = this.connectedClients.get(userId) || [];
    existing.push(client);
    this.connectedClients.set(userId, existing);
  }

  removeClient(userId: string, socketId: string): void {
    const clients = this.connectedClients.get(userId);
    if (!clients) return;
    const filtered = clients.filter((c) => c.socketId !== socketId);
    if (filtered.length === 0) {
      this.connectedClients.delete(userId);
    } else {
      this.connectedClients.set(userId, filtered);
    }
  }

  isInSameLesson(userId1: string, userId2: string, serverSockets: Map<string, any>): boolean {
    const clients1 = this.connectedClients.get(userId1);
    const clients2 = this.connectedClients.get(userId2);
    if (!clients1 || !clients2) return false;

    for (const c1 of clients1) {
      const socket1 = serverSockets.get(c1.socketId);
      if (!socket1) continue;
      for (const c2 of clients2) {
        const socket2 = serverSockets.get(c2.socketId);
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

  checkChatRate(socketId: string): boolean {
    const now = Date.now();
    const record = this.chatRateLimits.get(socketId);
    if (!record || now > record.resetAt) {
      this.chatRateLimits.set(socketId, { count: 1, resetAt: now + 60000 });
      return true;
    }
    if (record.count >= 30) return false;
    record.count++;
    return true;
  }
}
