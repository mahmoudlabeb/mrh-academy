import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
      const studentProfile = await manager.findOne(StudentProfile, {
        where: { userId: studentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!studentProfile) {
        throw new NotFoundException('Student profile not found');
      }

      if (studentProfile.balance < price) {
        throw new BadRequestException('Insufficient balance');
      }

      const overlapping = await manager
        .createQueryBuilder(Lesson, 'lesson')
        .where('lesson.status IN (:...activeStatuses)', {
          activeStatuses: [LessonStatus.PENDING, LessonStatus.CONFIRMED],
        })
        .andWhere(
          '(lesson.tutorId = :tutorId OR lesson.studentId = :studentId)',
          { tutorId: dto.tutorId, studentId },
        )
        .andWhere('lesson.scheduledTime < :endTime', { endTime })
        .andWhere('lesson.endTime > :scheduledDate', { scheduledDate })
        .getCount();

      if (overlapping > 0) {
        throw new BadRequestException(
          'Time slot conflicts with an existing lesson',
        );
      }

      await manager.decrement(
        StudentProfile,
        { userId: studentId },
        'balance',
        price,
      );

      const roomId = `room-${randomUUID()}`;

      const lessonEntity = manager.create(Lesson, {
        tutorId: dto.tutorId,
        studentId,
        scheduledTime: scheduledDate,
        endTime,
        durationMinutes: dto.durationMinutes,
        price,
        status: LessonStatus.CONFIRMED,
        meetUrl: roomId,
      });
      const saved = await manager.save(Lesson, lessonEntity);

      const classroom = manager.create(Classroom, {
        lessonId: saved.id,
        isActive: true,
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
          'New Lesson Booked — MRH Academy',
          `<p>A new lesson has been booked with you.</p>
<p>Student: ${savedLesson?.student?.firstName ?? 'Student'} ${savedLesson?.student?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>`,
        )
        .catch(() => {});
    }

    if (studentUser?.email) {
      this.emailService
        .sendEmail(
          studentUser.email,
          'Lesson Booking Confirmed — MRH Academy',
          `<p>Your lesson has been booked successfully.</p>
<p>Tutor: ${savedLesson?.tutor?.firstName ?? 'Tutor'} ${savedLesson?.tutor?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>`,
        )
        .catch(() => {});
    }

    return savedLesson;
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
        .catch(() => {});
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
        .catch(() => {});
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
        .catch(() => {});
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
      location: lesson.meetUrl || '',
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
    const dayOfWeek = scheduledDate.getDay();
    const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    if (daySlots.length === 0) {
      throw new BadRequestException('Tutor is not available on this day');
    }
    const startMin = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
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
