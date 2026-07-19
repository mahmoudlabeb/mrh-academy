import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@mrh/types';
import { Classroom } from '../entities/classroom.entity.js';
import { RedisService } from '../redis/redis.service.js';
import { getClassroomSocketData } from '../common/types/classroom-socket.js';

@Injectable()
export class WhiteboardService {
  private static readonly MAX_ACTIONS_PER_PAGE = 2000;
  private static readonly MAX_WHITEBOARD_PAGES = 50;

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
  ) {}

  async handleCanvasDraw(
    server: Server,
    socket: Socket,
    payload: { lessonId: string; page: number; data: unknown },
  ): Promise<void> {
    const { lessonId, page, data } = payload;

    socket.to(lessonId).emit('canvas_update', {
      userId: getClassroomSocketData(socket).userId,
      page,
      data,
    });

    const whiteboardKey = `whiteboard:${lessonId}`;
    const existing = await this.redisService.get(whiteboardKey);
    if (!existing) return;

    try {
      const parsed = JSON.parse(existing);
      const pageStr = String(page);
      if (
        !parsed.pages[pageStr] &&
        Object.keys(parsed.pages).length >= WhiteboardService.MAX_WHITEBOARD_PAGES
      ) {
        return;
      }
      if (!parsed.pages[pageStr]) {
        parsed.pages[pageStr] = [];
      }
      if (
        parsed.pages[pageStr].length < WhiteboardService.MAX_ACTIONS_PER_PAGE
      ) {
        parsed.pages[pageStr].push(data);
      }
      await this.redisService.set(
        whiteboardKey,
        JSON.stringify(parsed),
        'EX',
        86400,
      );
      await this.persistToDb(lessonId, parsed);
    } catch {
      // ignore parse errors
    }
  }

  async handleWhiteboardSync(
    server: Server,
    socket: Socket,
    payload: { lessonId: string },
  ): Promise<void> {
    const { lessonId } = payload;
    const whiteboardKey = `whiteboard:${lessonId}`;
    const state = await this.redisService.get(whiteboardKey);
    if (state) {
      socket.emit('whiteboard_sync', JSON.parse(state));
    }
  }

  async handleWhiteboardPageChange(
    server: Server,
    socket: Socket,
    payload: { lessonId: string; page: number },
  ): Promise<void> {
    const { lessonId, page } = payload;
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
        await this.persistToDb(lessonId, parsed);
      } catch {
        // ignore
      }
    }

    socket.to(lessonId).emit('whiteboard_page_change', { page });
  }

  async handleBookPresent(
    server: Server,
    socket: Socket,
    payload: {
      lessonId: string;
      bookId: string;
      title: string;
      pageCount: number;
      page?: number;
    },
  ): Promise<void> {
    if (getClassroomSocketData(socket).role !== UserRole.TUTOR.toString()) return;
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
    server.to(payload.lessonId).emit('book_sync', state);
  }

  async handleBookPageChange(
    server: Server,
    socket: Socket,
    payload: { lessonId: string; page: number },
  ): Promise<void> {
    if (getClassroomSocketData(socket).role !== UserRole.TUTOR.toString()) return;
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
      server.to(payload.lessonId).emit('book_page_change', { page });
    } catch {
      // ignore
    }
  }

  async handleBookClose(
    server: Server,
    socket: Socket,
    payload: { lessonId: string },
  ): Promise<void> {
    if (getClassroomSocketData(socket).role !== UserRole.TUTOR.toString()) return;
    const bookKey = `book:${payload.lessonId}`;
    await this.redisService.del(bookKey);
    server.to(payload.lessonId).emit('book_close', {});
  }

  async loadWhiteboard(
    lessonId: string,
  ): Promise<string | null> {
    const whiteboardKey = `whiteboard:${lessonId}`;
    let whiteboardState = await this.redisService.get(whiteboardKey);
    if (!whiteboardState) {
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
    return whiteboardState;
  }

  async loadBook(lessonId: string): Promise<string | null> {
    const bookKey = `book:${lessonId}`;
    return this.redisService.get(bookKey);
  }

  private async persistToDb(
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
}
