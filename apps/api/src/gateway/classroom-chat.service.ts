import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import sanitizeHtml from 'sanitize-html';
import { getClassroomSocketData } from '../common/types/classroom-socket.js';
import { ClassroomState } from './classroom-state.service.js';

@Injectable()
export class ChatService {
  constructor(private readonly state: ClassroomState) {}

  handleSendChat(
    server: Server,
    socket: Socket,
    payload: { lessonId: string; content: string },
  ): void {
    const { lessonId, content } = payload;
    if (!this.state.checkChatRate(socket.id)) return;
    if (!content || typeof content !== 'string') return;
    if (content.length > 2000) return;

    const sanitized = sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    if (!sanitized) return;

    server.to(lessonId).emit('chat_message', {
      senderId: getClassroomSocketData(socket).userId,
      content: sanitized,
      timestamp: new Date().toISOString(),
    });
  }
}
