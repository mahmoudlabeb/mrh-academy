import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClassroomAccessState,
  LessonPaymentStatus,
  LessonStatus,
} from '@mrh/types';
import { Repository } from 'typeorm';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Classroom } from './entities/classroom.entity.js';

const CLASSROOM_JOIN_EARLY_MINUTES = 15;
const CLASSROOM_JOIN_LATE_GRACE_MINUTES = 15;

/** @public */
export interface ClassroomAccessDecision {
  state: ClassroomAccessState;
  canJoin: boolean;
  reason: string;
  opensAt: string;
  closesAt: string;
  serverTime: string;
}

type ClassroomLesson = Pick<
  Lesson,
  | 'id'
  | 'studentId'
  | 'tutorId'
  | 'scheduledTime'
  | 'endTime'
  | 'durationMinutes'
  | 'status'
  | 'paymentStatus'
>;

@Injectable()
export class ClassroomAccessService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
  ) {}

  async findByRoomId(roomId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: [{ roomId }, { meetUrl: roomId }],
      relations: { tutor: true, student: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const access = await this.evaluate(lesson, userId);
    return { lesson, access };
  }

  async findByLessonId(lessonId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const access = await this.evaluate(lesson, userId);
    return { lesson, access };
  }

  async evaluate(
    lesson: ClassroomLesson,
    userId: string,
    now = new Date(),
  ): Promise<ClassroomAccessDecision> {
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }

    const scheduledTime = new Date(lesson.scheduledTime);
    const endTime = lesson.endTime
      ? new Date(lesson.endTime)
      : new Date(
          scheduledTime.getTime() + Number(lesson.durationMinutes) * 60_000,
        );
    const opensAt = new Date(
      scheduledTime.getTime() - CLASSROOM_JOIN_EARLY_MINUTES * 60_000,
    );
    const closesAt = new Date(
      endTime.getTime() + CLASSROOM_JOIN_LATE_GRACE_MINUTES * 60_000,
    );
    const base = {
      opensAt: opensAt.toISOString(),
      closesAt: closesAt.toISOString(),
      serverTime: now.toISOString(),
    };

    if (lesson.status === LessonStatus.CANCELLED) {
      return this.decision(
        ClassroomAccessState.CANCELLED,
        'This lesson was cancelled',
        base,
      );
    }
    if (lesson.paymentStatus === LessonPaymentStatus.REFUNDED) {
      return this.decision(
        ClassroomAccessState.REFUNDED,
        'This lesson was refunded',
        base,
      );
    }
    if (lesson.paymentStatus !== LessonPaymentStatus.PAID) {
      return this.decision(
        ClassroomAccessState.UNPAID,
        'A confirmed payment is required to enter this classroom',
        base,
      );
    }
    if (lesson.status !== LessonStatus.CONFIRMED) {
      return this.decision(
        ClassroomAccessState.EXPIRED,
        'This lesson has ended',
        base,
      );
    }

    const classroom = await this.classroomRepository.findOne({
      where: { lessonId: lesson.id },
      select: ['lessonId', 'isActive'],
    });
    if (!classroom?.isActive) {
      return this.decision(
        ClassroomAccessState.CLOSED,
        'This classroom is closed',
        base,
      );
    }
    if (now.getTime() < opensAt.getTime()) {
      return this.decision(
        ClassroomAccessState.WAITING,
        'This classroom is not open yet',
        base,
      );
    }
    if (now.getTime() > closesAt.getTime()) {
      return this.decision(
        ClassroomAccessState.EXPIRED,
        'This lesson has ended',
        base,
      );
    }

    return {
      state: ClassroomAccessState.ALLOWED,
      canJoin: true,
      reason: 'Classroom access granted',
      ...base,
    };
  }

  private decision(
    state: ClassroomAccessState,
    reason: string,
    timestamps: Omit<ClassroomAccessDecision, 'state' | 'canJoin' | 'reason'>,
  ): ClassroomAccessDecision {
    return {
      state,
      canJoin: false,
      reason,
      ...timestamps,
    };
  }
}
