import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { UserRole, LessonStatus, CourseStatus } from '@mrh/types';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { TutorAvailability } from '../entities/tutor-availability.entity.js';
import { CommissionService } from '../services/commission.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { EmailService } from '../services/email.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';

const CANCELLATION_REFUND_HOURS = 24;

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TutorAvailability)
    private readonly availabilityRepository: Repository<TutorAvailability>,
    private readonly commissionService: CommissionService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly calendarService: CalendarService,
    private readonly dataSource: DataSource,
  ) {}

  async findUserLessons(userId: string, role: UserRole) {
    const where =
      role === UserRole.TUTOR ? { tutorId: userId } : { studentId: userId };

    return this.lessonRepository.find({
      where,
      relations: {
        tutor: true,
        student: true,
      },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      order: { scheduledTime: 'DESC' },
    });
  }

  async bookLesson(studentId: string, dto: BookLessonDto) {
    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: dto.tutorId },
    });

    if (!tutorProfile) {
      throw new NotFoundException('Tutor not found');
    }

    if (tutorProfile.status !== CourseStatus.APPROVED) {
      throw new BadRequestException('Tutor is not approved');
    }

    const price =
      Math.round(tutorProfile.hourlyRate * (dto.durationMinutes / 60) * 100) /
      100;

    const scheduledDate = new Date(dto.scheduledTime);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduled time format');
    }
    if (scheduledDate.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const endTime = new Date(
      scheduledDate.getTime() + dto.durationMinutes * 60000,
    );

    await this.assertWithinAvailability(
      dto.tutorId,
      scheduledDate,
      dto.durationMinutes,
    );

    const lesson = await this.dataSource.transaction(async (manager) => {
      const tutorProfileLocked = await manager.findOne(TutorProfile, {
        where: { userId: dto.tutorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tutorProfileLocked) {
        throw new NotFoundException('Tutor not found');
      }

      const overlapping = await manager
        .createQueryBuilder(Lesson, 'l')
        .setLock('pessimistic_read')
        .where('l.tutorId = :tutorId', { tutorId: dto.tutorId })
        .andWhere('l.status IN (:...statuses)', {
          statuses: [LessonStatus.PENDING, LessonStatus.CONFIRMED],
        })
        .andWhere('l.scheduledTime < :endTime', { endTime })
        .andWhere('l.endTime > :scheduledDate', { scheduledDate })
        .getOne();

      if (overlapping) {
        throw new BadRequestException(
          'Tutor already has a lesson at this time',
        );
      }

      const roomId = `room-${randomUUID()}`;

      const lessonEntity = manager.create(Lesson, {
        tutorId: dto.tutorId,
        studentId,
        scheduledTime: scheduledDate,
        endTime,
        durationMinutes: dto.durationMinutes,
        price,
        status: LessonStatus.PENDING,
        roomId,
        meetUrl: roomId,
      });
      const saved = await manager.save(Lesson, lessonEntity);

      const classroom = manager.create(Classroom, {
        lessonId: saved.id,
        isActive: false,
      });
      await manager.save(Classroom, classroom);

      return saved;
    });

    await this.redisService.del(`lessons:user:${studentId}`);
    await this.redisService.del(`lessons:user:${dto.tutorId}`);

    const savedLesson = await this.lessonRepository.findOne({
      where: { id: lesson.id },
      relations: { tutor: true, student: true },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        platformFee: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    });

    const [tutorUser, studentUser] = await Promise.all([
      this.userRepository.findOne({
        where: { id: dto.tutorId },
        select: { id: true, email: true },
      }),
      this.userRepository.findOne({
        where: { id: studentId },
        select: { id: true, email: true },
      }),
    ]);

    if (tutorUser?.email) {
      this.emailService
        .sendEmail(
          tutorUser.email,
          'New Lesson Request — MRH Academy',
          `<p>A student has requested a lesson with you.</p>
<p>Student: ${savedLesson?.student?.firstName ?? 'Student'} ${savedLesson?.student?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
<p>Please log in to approve or decline this lesson request.</p>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    if (studentUser?.email) {
      this.emailService
        .sendEmail(
          studentUser.email,
          'Lesson Request Sent — MRH Academy',
          `<p>Your lesson request has been sent to the tutor for approval.</p>
<p>Tutor: ${savedLesson?.tutor?.firstName ?? 'Tutor'} ${savedLesson?.tutor?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
<p>You will receive a confirmation once the tutor approves.</p>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return savedLesson;
  }

  async approveLesson(lessonId: string, tutorId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, tutorId },
      relations: { tutor: true, student: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.tutorId !== tutorId) {
      throw new ForbiddenException('Only the tutor can approve a lesson');
    }

    if (lesson.status !== LessonStatus.PENDING) {
      throw new BadRequestException('Lesson is not in pending status');
    }

    const scheduledDate = lesson.scheduledTime;
    const endTime =
      lesson.endTime ||
      new Date(scheduledDate.getTime() + lesson.durationMinutes * 60000);

    const price = lesson.price;

    await this.dataSource.transaction(async (manager) => {
      const overlappingLesson = await manager
        .createQueryBuilder(Lesson, 'lesson')
        .setLock('pessimistic_read')
        .where('lesson.tutorId = :tutorId', { tutorId })
        .andWhere('lesson.id != :lessonId', { lessonId })
        .andWhere('lesson.status = :status', {
          status: LessonStatus.CONFIRMED,
        })
        .andWhere('lesson.scheduledTime < :endTime', { endTime })
        .andWhere('lesson.endTime > :scheduledDate', { scheduledDate })
        .getOne();

      if (overlappingLesson) {
        throw new BadRequestException(
          'Tutor already has a lesson at this time',
        );
      }

      const studentProfile = await manager.findOne(StudentProfile, {
        where: { userId: lesson.studentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!studentProfile) {
        throw new NotFoundException('Student profile not found');
      }

      if (studentProfile.balance < price) {
        throw new BadRequestException('Student has insufficient balance');
      }

      await manager.decrement(
        StudentProfile,
        { userId: lesson.studentId },
        'balance',
        price,
      );

      await manager.update(
        Lesson,
        { id: lessonId },
        { status: LessonStatus.CONFIRMED },
      );

      await manager.update(Classroom, { lessonId }, { isActive: true });
    });

    await this.redisService.del(`lessons:user:${lesson.studentId}`);
    await this.redisService.del(`lessons:user:${lesson.tutorId}`);

    const updatedLesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });

    let googleMeetUrl: string | null = null;
    const [tutorUser, studentUser] = await Promise.all([
      this.userRepository.findOne({
        where: { id: lesson.tutorId },
        select: { id: true, email: true },
      }),
      this.userRepository.findOne({
        where: { id: lesson.studentId },
        select: { id: true, email: true },
      }),
    ]);

    const meetLinkResult = await this.calendarService.createLessonMeetLink({
      summary: `MRH Academy Lesson: ${updatedLesson?.tutor?.firstName ?? 'Tutor'} & ${updatedLesson?.student?.firstName ?? 'Student'}`,
      description: 'Language lesson booked on MRH Academy.',
      start: scheduledDate,
      end: endTime,
      tutorEmail:
        tutorUser?.email ??
        `tutor-${lesson.tutorId}@lessons.mrhacademy.internal`,
      studentEmail:
        studentUser?.email ??
        `student-${lesson.studentId}@lessons.mrhacademy.internal`,
    });

    if (meetLinkResult) {
      googleMeetUrl = meetLinkResult.meetUrl;
      await this.lessonRepository.update(lesson.id, {
        googleMeetUrl,
        ...(meetLinkResult.calendarEventId
          ? { calendarEventId: meetLinkResult.calendarEventId }
          : {}),
      });
    }

    if (tutorUser?.email) {
      this.emailService
        .sendEmail(
          tutorUser.email,
          'Lesson Approved — MRH Academy',
          `<p>You have approved the lesson.</p>
<p>Student: ${updatedLesson?.student?.firstName ?? 'Student'} ${updatedLesson?.student?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${lesson.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>📹 Video Meeting: <a href="${googleMeetUrl}">Join here</a></p>` : ''}`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    if (studentUser?.email) {
      this.emailService
        .sendEmail(
          studentUser.email,
          'Lesson Approved — MRH Academy',
          `<p>Your lesson has been approved by the tutor.</p>
<p>Tutor: ${updatedLesson?.tutor?.firstName ?? 'Tutor'} ${updatedLesson?.tutor?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${lesson.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>📹 Video Meeting: <a href="${googleMeetUrl}">Join here</a></p>` : ''}`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return updatedLesson;
  }

  async rejectLesson(lessonId: string, tutorId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, tutorId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.tutorId !== tutorId) {
      throw new ForbiddenException('Only the tutor can reject a lesson');
    }

    if (lesson.status !== LessonStatus.PENDING) {
      throw new BadRequestException('Lesson is not in pending status');
    }

    await this.lessonRepository.update(lessonId, {
      status: LessonStatus.CANCELLED,
    });

    await this.redisService.del(`lessons:user:${lesson.studentId}`);
    await this.redisService.del(`lessons:user:${lesson.tutorId}`);

    return { message: 'Lesson request rejected' };
  }

  async completeLesson(
    lessonId: string,
    userId: string,
    dto?: CompleteLessonDto,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: {
        tutor: true,
        student: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.tutorId !== userId) {
      throw new ForbiddenException('Only the tutor can complete a lesson');
    }

    if (lesson.status !== LessonStatus.CONFIRMED) {
      throw new BadRequestException('Lesson must be in confirmed status');
    }

    if (Date.now() < lesson.scheduledTime.getTime()) {
      throw new BadRequestException(
        'Lesson cannot be completed before it starts',
      );
    }

    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: lesson.tutorId },
    });

    if (!tutorProfile) {
      throw new NotFoundException('Tutor profile not found');
    }

    const { platformFee, tutorShare } =
      this.commissionService.calculateLessonEarnings(
        lesson.price,
        tutorProfile.totalHoursTaught,
      );

    const hoursToAdd = lesson.durationMinutes / 60;

    await this.dataSource.transaction(async (manager) => {
      const lockedLesson = await manager.findOne(Lesson, {
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedLesson || lockedLesson.status !== LessonStatus.CONFIRMED) {
        throw new BadRequestException(
          'Lesson is already completed or cancelled',
        );
      }

      await manager.update(
        Lesson,
        { id: lessonId },
        {
          status: LessonStatus.COMPLETED,
          platformFee,
          ...(dto?.notes ? { notes: dto.notes } : {}),
        },
      );

      await manager.increment(
        TutorProfile,
        { userId: lesson.tutorId },
        'totalHoursTaught',
        hoursToAdd,
      );

      await manager.increment(
        TutorProfile,
        { userId: lesson.tutorId },
        'balance',
        tutorShare,
      );

      await manager.update(Classroom, { lessonId }, { isActive: false });
    });

    await this.redisService.del(`lessons:user:${lesson.tutorId}`);
    await this.redisService.del(`lessons:user:${lesson.studentId}`);

    const completed = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        platformFee: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    });

    if (lesson.student?.email) {
      this.emailService
        .sendEmail(
          lesson.student.email,
          'Lesson Completed — MRH Academy',
          `<p>Your lesson has been marked as completed.</p>
<p>Tutor: ${completed?.tutor?.firstName ?? 'Tutor'} ${completed?.tutor?.lastName ?? ''}</p>
<p>Price: $${lesson.price.toFixed(2)}</p>
<p>Platform Fee: $${platformFee.toFixed(2)}</p>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return completed;
  }

  async cancelLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }
    if (
      lesson.status !== LessonStatus.CONFIRMED &&
      lesson.status !== LessonStatus.PENDING
    ) {
      throw new BadRequestException('Lesson cannot be cancelled');
    }

    const hoursUntilLesson =
      (lesson.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilLesson < 0) {
      throw new BadRequestException(
        'Cannot cancel a lesson that has already started',
      );
    }

    const isTutor = lesson.tutorId === userId;
    const shouldRefund =
      isTutor || hoursUntilLesson >= CANCELLATION_REFUND_HOURS;

    let refundAmount = 0;

    await this.dataSource.transaction(async (manager) => {
      const lockedLesson = await manager.findOne(Lesson, {
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !lockedLesson ||
        (lockedLesson.status !== LessonStatus.CONFIRMED &&
          lockedLesson.status !== LessonStatus.PENDING)
      ) {
        throw new BadRequestException('Lesson cannot be cancelled');
      }

      lockedLesson.status = LessonStatus.CANCELLED;
      await manager.save(Lesson, lockedLesson);

      if (shouldRefund) {
        await manager.increment(
          StudentProfile,
          { userId: lockedLesson.studentId },
          'balance',
          lockedLesson.price,
        );
        refundAmount = lockedLesson.price;
      }

      await manager.update(Classroom, { lessonId }, { isActive: false });
    });

    await this.redisService.del(`lessons:user:${lesson.tutorId}`);
    await this.redisService.del(`lessons:user:${lesson.studentId}`);

    if (lesson.calendarEventId) {
      await this.calendarService.deleteCalendarEvent(lesson.calendarEventId);
    }

    const cancelled = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
        },
      },
    });

    const tutorName = cancelled?.tutor
      ? `${cancelled.tutor.firstName} ${cancelled.tutor.lastName}`
      : 'Tutor';
    const studentName = cancelled?.student
      ? `${cancelled.student.firstName} ${cancelled.student.lastName}`
      : 'Student';
    const scheduledLabel = lesson.scheduledTime.toLocaleString();
    const refundNote = shouldRefund
      ? `<p>A refund of $${refundAmount.toFixed(2)} has been credited to the student balance.</p>`
      : `<p>No refund was issued (cancellation within ${CANCELLATION_REFUND_HOURS} hours of the lesson).</p>`;

    if (lesson.tutor?.email) {
      this.emailService
        .sendEmail(
          lesson.tutor.email,
          'Lesson Cancelled — MRH Academy',
          `<p>A lesson has been cancelled.</p>
<p>Student: ${studentName}</p>
<p>Scheduled: ${scheduledLabel}</p>
${refundNote}`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    if (lesson.student?.email) {
      const studentRefundNote = shouldRefund
        ? `<p>$${refundAmount.toFixed(2)} has been refunded to your balance.</p>`
        : `<p>No refund was issued because the cancellation was within ${CANCELLATION_REFUND_HOURS} hours of the lesson start time.</p>`;

      this.emailService
        .sendEmail(
          lesson.student.email,
          'Lesson Cancelled — MRH Academy',
          `<p>Your lesson has been cancelled.</p>
<p>Tutor: ${tutorName}</p>
<p>Scheduled: ${scheduledLabel}</p>
${studentRefundNote}`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return {
      ...cancelled,
      refunded: shouldRefund,
      refundAmount,
    };
  }

  async exportIcal(
    lessonId: string,
    userId: string,
    calendarService: CalendarService,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }

    const tutorName = lesson.tutor
      ? `${lesson.tutor.firstName} ${lesson.tutor.lastName}`
      : 'Tutor';
    const studentName = lesson.student
      ? `${lesson.student.firstName} ${lesson.student.lastName}`
      : 'Student';

    return calendarService.generateIcs({
      summary: `Lesson: ${tutorName} & ${studentName}`,
      description: `Language lesson between ${tutorName} (tutor) and ${studentName} (student).`,
      start: lesson.scheduledTime,
      end:
        lesson.endTime ||
        new Date(
          lesson.scheduledTime.getTime() + lesson.durationMinutes * 60000,
        ),
      location: lesson.googleMeetUrl || lesson.meetUrl || '',
      uid: `lesson-${lesson.id}`,
    });
  }

  async findByRoomId(roomId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { meetUrl: roomId },
      relations: { tutor: true, student: true },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }
    if (
      lesson.status === LessonStatus.COMPLETED ||
      lesson.status === LessonStatus.CANCELLED
    ) {
      throw new BadRequestException('This lesson is no longer available');
    }
    const classroom = await this.classroomRepository.findOne({
      where: { lessonId: lesson.id },
    });
    if (classroom && !classroom.isActive) {
      throw new BadRequestException('Classroom is closed');
    }
    return lesson;
  }

  async findLessonForParticipant(lessonId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
      select: {
        id: true,
        tutorId: true,
        studentId: true,
        scheduledTime: true,
        durationMinutes: true,
        status: true,
        price: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }
    if (
      lesson.status === LessonStatus.COMPLETED ||
      lesson.status === LessonStatus.CANCELLED
    ) {
      throw new BadRequestException('This lesson is no longer available');
    }
    const classroom = await this.classroomRepository.findOne({
      where: { lessonId: lesson.id },
    });
    if (classroom && !classroom.isActive) {
      throw new BadRequestException('Classroom is closed');
    }
    return lesson;
  }

  private timeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
  }

  private async assertWithinAvailability(
    tutorId: string,
    scheduledDate: Date,
    durationMinutes: number,
  ): Promise<void> {
    const slots = await this.availabilityRepository.find({
      where: { tutorId },
    });
    if (slots.length === 0) {
      throw new BadRequestException('Tutor has not set availability');
    }
    const dayOfWeek = scheduledDate.getUTCDay();
    const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    if (daySlots.length === 0) {
      throw new BadRequestException('Tutor is not available on this day');
    }
    const startMin =
      scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes();
    const endMin = startMin + durationMinutes;
    const fits = daySlots.some((slot) => {
      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd = this.timeToMinutes(slot.endTime);
      return startMin >= slotStart && endMin <= slotEnd;
    });
    if (!fits) {
      throw new BadRequestException(
        'Selected time is outside tutor availability',
      );
    }
  }
}
