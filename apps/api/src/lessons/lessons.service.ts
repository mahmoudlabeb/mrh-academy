import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  UserRole,
  LessonPaymentStatus,
  LessonStatus,
  CourseStatus,
  PaymentStatus,
} from '@mrh/types';
import { Lesson } from './entities/lesson.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { Classroom } from '../classroom/entities/classroom.entity.js';
import { User } from '../users/entities/user.entity.js';
import { TutorAvailability } from '../tutors/entities/tutor-availability.entity.js';
import { CommissionService } from '../payments/commission.service.js';
import { CalendarService } from '../integrations/google/calendar.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';
import { RescheduleLessonDto } from './dto/reschedule-lesson.dto.js';
import { Notification } from '../messages/entities/notification.entity.js';
import { ClassroomAccessService } from '../classroom/classroom-access.service.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { LessonFundingAllocation } from '../payments/entities/lesson-funding-allocation.entity.js';

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
    @Optional()
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification> | null,
    private readonly commissionService: CommissionService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly calendarService: CalendarService,
    private readonly dataSource: DataSource,
    private readonly classroomAccessService: ClassroomAccessService,
  ) {}

  async findUserLessons(userId: string, role: UserRole, page = 1, limit = 20) {
    const where =
      role === UserRole.TUTOR ? { tutorId: userId } : { studentId: userId };
    const skip = (page - 1) * limit;

    const [data, total] = await this.lessonRepository.findAndCount({
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
        endTime: true,
        durationMinutes: true,
        status: true,
        paymentStatus: true,
        price: true,
        roomId: true,
        meetUrl: true,
        googleMeetUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        tutor: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          timezone: true,
        },
        student: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      order: { scheduledTime: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: data.map((lesson) => this.presentLesson(lesson)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async bookLesson(studentId: string, dto: BookLessonDto) {
    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    if (dto.idempotencyKey) {
      const existingLesson = await this.lessonRepository.findOne({
        where: { idempotencyKey },
        relations: { tutor: true, student: true },
      });
      if (existingLesson) {
        this.assertMatchingBookingRetry(existingLesson, studentId, dto);
        return existingLesson;
      }
    }

    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: dto.tutorId },
      relations: { user: true },
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
    const lessonEarnings = this.commissionService.calculateLessonEarnings(
      price,
      tutorProfile.totalHoursTaught,
    );

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
      tutorProfile.user?.timezone ?? 'UTC',
    );

    let booking: { lesson: Lesson; created: boolean };
    try {
      booking = await this.dataSource.transaction(async (manager) => {
        const studentProfile = await manager.findOne(StudentProfile, {
          where: { userId: studentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!studentProfile) {
          throw new NotFoundException('Student profile not found');
        }

        // Serializing on the student's wallet makes retries safe even when two
        // requests with the same key arrive at the same time.
        if (dto.idempotencyKey) {
          const duplicate = await manager.findOne(Lesson, {
            where: { idempotencyKey },
          });
          if (duplicate) {
            this.assertMatchingBookingRetry(duplicate, studentId, dto);
            return { lesson: duplicate, created: false };
          }
        }

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
          .andWhere('l.status = :status', {
            status: LessonStatus.CONFIRMED,
          })
          .andWhere('l.scheduledTime < :endTime', { endTime })
          .andWhere('l.endTime > :scheduledDate', { scheduledDate })
          .getOne();

        if (overlapping) {
          throw new BadRequestException(
            'Tutor already has a lesson at this time',
          );
        }

        const availableBalance =
          Number(studentProfile.balance) -
          Number(studentProfile.heldBalance ?? 0);
        if (availableBalance < price) {
          throw new BadRequestException('Student has insufficient balance');
        }

        const studentUser = await manager.findOne(User, {
          where: { id: studentId, isActive: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (!studentUser) {
          throw new BadRequestException('Student account is no longer active');
        }

        const roomId = `room-${randomUUID()}`;

        const lessonEntity = manager.create(Lesson, {
          tutorId: dto.tutorId,
          studentId,
          scheduledTime: scheduledDate,
          endTime,
          durationMinutes: dto.durationMinutes,
          price,
          idempotencyKey,
          status: LessonStatus.CONFIRMED,
          paymentStatus: LessonPaymentStatus.PAID,
          platformFee: lessonEarnings.platformFee,
          tutorShare: lessonEarnings.tutorShare,
          tutorShareReleasedAt: null,
          roomId,
          meetUrl: roomId,
        });
        const saved = await manager.save(Lesson, lessonEntity);
        await manager.decrement(
          StudentProfile,
          { userId: studentId },
          'balance',
          price,
        );
        let amountToAllocate = price;
        const deposits = await manager.find(Payment, {
          where: {
            userId: studentId,
            status: In([
              PaymentStatus.APPROVED,
              PaymentStatus.PARTIALLY_REFUNDED,
            ]),
          },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        for (const deposit of deposits) {
          if (amountToAllocate <= 0) break;
          const creditedAmountUsd =
            deposit.creditedAmountUsd ??
            (deposit.currency === 'EGP'
              ? Number(deposit.amount) /
                (await this.commissionService.getEgpRate())
              : Number(deposit.amount));
          const refundedAmountUsd =
            Number(deposit.amount) > 0
              ? (Number(deposit.refundedAmount ?? 0) / Number(deposit.amount)) *
                creditedAmountUsd
              : 0;
          const available = Math.max(
            0,
            creditedAmountUsd -
              refundedAmountUsd -
              Number(deposit.allocatedAmount ?? 0),
          );
          if (available <= 0) continue;
          const allocated = Math.min(available, amountToAllocate);
          deposit.allocatedAmount =
            Number(deposit.allocatedAmount ?? 0) + allocated;
          await manager.save(Payment, deposit);
          await manager.save(
            LessonFundingAllocation,
            manager.create(LessonFundingAllocation, {
              paymentId: deposit.id,
              lessonId: saved.id,
              amount: allocated,
            }),
          );
          amountToAllocate =
            Math.round((amountToAllocate - allocated) * 100) / 100;
        }
        await manager.save(
          Classroom,
          manager.create(Classroom, { lessonId: saved.id, isActive: true }),
        );

        return { lesson: saved, created: true };
      });
    } catch (error) {
      const errorCode =
        (error as { code?: string; driverError?: { code?: string } })?.code ??
        (error as { driverError?: { code?: string } })?.driverError?.code;
      if (dto.idempotencyKey && errorCode === '23505') {
        const duplicate = await this.lessonRepository.findOne({
          where: { idempotencyKey: dto.idempotencyKey },
          relations: { tutor: true, student: true },
        });
        if (duplicate) {
          this.assertMatchingBookingRetry(duplicate, studentId, dto);
          return duplicate;
        }
      }
      throw error;
    }

    if (!booking.created) {
      return this.lessonRepository.findOne({
        where: { id: booking.lesson.id },
        relations: { tutor: true, student: true },
      });
    }

    const lesson = booking.lesson;

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
        paymentStatus: true,
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

    let googleMeetUrl: string | null = null;
    try {
      const meetLinkResult = await this.calendarService.createLessonMeetLink({
        summary: `MRH Academy Lesson: ${savedLesson?.tutor?.firstName ?? 'Tutor'} & ${savedLesson?.student?.firstName ?? 'Student'}`,
        description: 'Language lesson booked on MRH Academy.',
        start: scheduledDate,
        end: endTime,
        tutorEmail:
          tutorUser?.email ??
          `tutor-${dto.tutorId}@lessons.mrhacademy.internal`,
        studentEmail:
          studentUser?.email ??
          `student-${studentId}@lessons.mrhacademy.internal`,
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
    } catch (error) {
      this.logger.warn(
        `Calendar link unavailable for lesson ${lesson.id}: ${String(error)}`,
      );
    }

    if (this.notificationRepository) {
      const notificationRepository = this.notificationRepository;
      await Promise.all(
        [
          {
            userId: studentId,
            title: 'Lesson confirmed | تم تأكيد الدرس',
            body: `Your payment was verified and your lesson is confirmed for ${scheduledDate.toLocaleString()}. | تم التحقق من الدفع وتأكيد درسك.`,
          },
          {
            userId: dto.tutorId,
            title: 'New confirmed lesson | درس مؤكد جديد',
            body: `A paid lesson is confirmed for ${scheduledDate.toLocaleString()}. No approval is required. | تم تأكيد درس مدفوع ولا يلزم اتخاذ إجراء.`,
          },
        ].map((notification) =>
          notificationRepository
            .save(
              notificationRepository.create({
                ...notification,
                type: 'lesson_confirmed',
                isRead: false,
              }),
            )
            .catch((error) =>
              this.logger.error('Lesson notification failed', error),
            ),
        ),
      );
    }

    if (tutorUser?.email) {
      this.emailService
        .sendEmail(
          tutorUser.email,
          'درس مؤكد جديد | New Confirmed Lesson — MRH Academy',
          `<div dir="rtl"><p>تم تأكيد درس مدفوع معك، ولا يلزم اتخاذ إجراء.</p>
<p>الطالب: ${savedLesson?.student?.firstName ?? 'الطالب'} ${savedLesson?.student?.lastName ?? ''}</p>
<p>الموعد: ${scheduledDate.toLocaleString('ar-EG')}</p>
<p>المدة: ${dto.durationMinutes} دقيقة</p>
<p>السعر: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>رابط الاجتماع: <a href="${googleMeetUrl}">انضم من هنا</a></p>` : ''}</div><hr><div dir="ltr">
<p>A paid lesson has been confirmed with you. No approval is required.</p>
<p>Student: ${savedLesson?.student?.firstName ?? 'Student'} ${savedLesson?.student?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>Video Meeting: <a href="${googleMeetUrl}">Join here</a></p>` : ''}</div>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    if (studentUser?.email) {
      this.emailService
        .sendEmail(
          studentUser.email,
          'تم تأكيد الدرس | Lesson Confirmed — MRH Academy',
          `<div dir="rtl"><p>تم التحقق من الدفع وتأكيد درسك فوراً.</p>
<p>المعلّم: ${savedLesson?.tutor?.firstName ?? 'المعلّم'} ${savedLesson?.tutor?.lastName ?? ''}</p>
<p>الموعد: ${scheduledDate.toLocaleString('ar-EG')}</p>
<p>المدة: ${dto.durationMinutes} دقيقة</p>
<p>السعر: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>رابط الاجتماع: <a href="${googleMeetUrl}">انضم من هنا</a></p>` : ''}</div><hr><div dir="ltr">
<p>Your payment was verified by the server and your lesson is confirmed.</p>
<p>Tutor: ${savedLesson?.tutor?.firstName ?? 'Tutor'} ${savedLesson?.tutor?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>
${googleMeetUrl ? `<p>Video Meeting: <a href="${googleMeetUrl}">Join here</a></p>` : ''}</div>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return savedLesson;
  }

  async rescheduleLesson(
    lessonId: string,
    tutorId: string,
    dto: RescheduleLessonDto,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.tutorId !== tutorId) {
      throw new ForbiddenException(
        'Only the assigned tutor can reschedule this lesson',
      );
    }
    if (lesson.status !== LessonStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only confirmed lessons can be rescheduled',
      );
    }

    const scheduledTime = new Date(dto.scheduledTime);
    if (Number.isNaN(scheduledTime.getTime())) {
      throw new BadRequestException('Invalid scheduled time format');
    }
    if (scheduledTime.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    if (lesson.scheduledTime.getTime() === scheduledTime.getTime()) {
      return { ...this.presentLesson(lesson), rescheduled: false };
    }

    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: tutorId },
      relations: { user: true },
    });
    if (!tutorProfile) {
      throw new NotFoundException('Tutor profile not found');
    }

    const endTime = new Date(
      scheduledTime.getTime() + lesson.durationMinutes * 60_000,
    );
    await this.assertWithinAvailability(
      tutorId,
      scheduledTime,
      lesson.durationMinutes,
      tutorProfile.user?.timezone ?? lesson.tutor?.timezone ?? 'UTC',
    );

    const change = await this.dataSource.transaction(async (manager) => {
      const lockedLesson = await manager.findOne(Lesson, {
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedLesson) {
        throw new NotFoundException('Lesson not found');
      }
      if (lockedLesson.tutorId !== tutorId) {
        throw new ForbiddenException(
          'Only the assigned tutor can reschedule this lesson',
        );
      }
      if (lockedLesson.status !== LessonStatus.CONFIRMED) {
        throw new BadRequestException(
          'Only confirmed lessons can be rescheduled',
        );
      }
      if (lockedLesson.scheduledTime.getTime() === scheduledTime.getTime()) {
        return { changed: false, previousCalendarEventId: null };
      }

      const overlapping = await manager
        .createQueryBuilder(Lesson, 'l')
        .setLock('pessimistic_read')
        .where('l.tutorId = :tutorId', { tutorId })
        .andWhere('l.id != :lessonId', { lessonId })
        .andWhere('l.status = :status', {
          status: LessonStatus.CONFIRMED,
        })
        .andWhere('l.scheduledTime < :endTime', { endTime })
        .andWhere('l.endTime > :scheduledTime', { scheduledTime })
        .getOne();
      if (overlapping) {
        throw new BadRequestException(
          'Tutor already has a lesson at this time',
        );
      }

      const previousCalendarEventId = lockedLesson.calendarEventId;
      lockedLesson.scheduledTime = scheduledTime;
      lockedLesson.endTime = endTime;
      lockedLesson.calendarEventId = null;
      lockedLesson.googleMeetUrl = null;
      await manager.save(Lesson, lockedLesson);
      return { changed: true, previousCalendarEventId };
    });

    if (!change.changed) {
      const current = await this.lessonRepository.findOne({
        where: { id: lessonId },
        relations: { tutor: true, student: true },
      });
      return {
        ...this.presentLesson(current ?? lesson),
        rescheduled: false,
      };
    }

    if (change.previousCalendarEventId) {
      await this.calendarService.deleteCalendarEvent(
        change.previousCalendarEventId,
      );
    }

    try {
      const meetLinkResult = await this.calendarService.createLessonMeetLink({
        summary: `MRH Academy Lesson: ${lesson.tutor?.firstName ?? 'Tutor'} & ${lesson.student?.firstName ?? 'Student'}`,
        description: 'Language lesson rescheduled on MRH Academy.',
        start: scheduledTime,
        end: endTime,
        tutorEmail:
          lesson.tutor?.email ??
          `tutor-${lesson.tutorId}@lessons.mrhacademy.internal`,
        studentEmail:
          lesson.student?.email ??
          `student-${lesson.studentId}@lessons.mrhacademy.internal`,
      });
      if (meetLinkResult) {
        await this.lessonRepository.update(lessonId, {
          googleMeetUrl: meetLinkResult.meetUrl,
          calendarEventId: meetLinkResult.calendarEventId ?? null,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Calendar update unavailable for rescheduled lesson ${lessonId}: ${String(error)}`,
      );
    }

    await this.redisService.del(`lessons:user:${lesson.tutorId}`);
    await this.redisService.del(`lessons:user:${lesson.studentId}`);

    const rescheduled = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
    if (!rescheduled) {
      lesson.scheduledTime = scheduledTime;
      lesson.endTime = endTime;
      lesson.calendarEventId = null;
      lesson.googleMeetUrl = null;
    }
    return {
      ...this.presentLesson(rescheduled ?? lesson),
      rescheduled: true,
    };
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

    const lessonEnd =
      lesson.endTime ??
      new Date(
        lesson.scheduledTime.getTime() + lesson.durationMinutes * 60_000,
      );
    if (Date.now() < lessonEnd.getTime()) {
      throw new BadRequestException(
        'Lesson cannot be completed before its scheduled end time',
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

      const recordedPlatformFee =
        lockedLesson.platformFee === null ||
        lockedLesson.platformFee === undefined
          ? platformFee
          : Number(lockedLesson.platformFee);
      const recordedTutorShare =
        lockedLesson.tutorShare === null ||
        lockedLesson.tutorShare === undefined
          ? tutorShare
          : Number(lockedLesson.tutorShare);
      const shouldRelease = !lockedLesson.tutorShareReleasedAt;
      lockedLesson.status = LessonStatus.COMPLETED;
      lockedLesson.platformFee = recordedPlatformFee;
      lockedLesson.tutorShare = recordedTutorShare;
      if (shouldRelease) lockedLesson.tutorShareReleasedAt = new Date();
      if (dto?.notes) lockedLesson.notes = dto.notes;
      await manager.save(Lesson, lockedLesson);

      await manager.increment(
        TutorProfile,
        { userId: lesson.tutorId },
        'totalHoursTaught',
        hoursToAdd,
      );

      if (shouldRelease) {
        await manager.increment(
          TutorProfile,
          { userId: lesson.tutorId },
          'balance',
          recordedTutorShare,
        );
      }

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
        paymentStatus: true,
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
          'اكتمل الدرس | Lesson Completed — MRH Academy',
          `<div dir="rtl"><p>تم تحديد درسك كمكتمل.</p>
<p>المعلّم: ${completed?.tutor?.firstName ?? 'المعلّم'} ${completed?.tutor?.lastName ?? ''}</p>
<p>السعر: $${lesson.price.toFixed(2)}</p>
<p>رسوم المنصة: $${platformFee.toFixed(2)}</p></div><hr><div dir="ltr">
<p>Your lesson has been marked as completed.</p>
<p>Tutor: ${completed?.tutor?.firstName ?? 'Tutor'} ${completed?.tutor?.lastName ?? ''}</p>
<p>Price: $${lesson.price.toFixed(2)}</p>
<p>Platform Fee: $${platformFee.toFixed(2)}</p></div>`,
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
    if (lesson.status === LessonStatus.CANCELLED) {
      return {
        ...this.presentLesson(lesson),
        refunded: true,
        refundAmount: Number(lesson.price),
        duplicate: true,
      };
    }
    if (lesson.status !== LessonStatus.CONFIRMED) {
      throw new BadRequestException('Lesson cannot be cancelled');
    }

    const hoursUntilLesson =
      (lesson.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilLesson < 0) {
      throw new BadRequestException(
        'Cannot cancel a lesson that has already started',
      );
    }
    if (
      lesson.studentId === userId &&
      lesson.status === LessonStatus.CONFIRMED &&
      hoursUntilLesson < 2
    ) {
      throw new BadRequestException(
        'Student cancellations require at least 2 hours notice',
      );
    }

    const cancellation = await this.dataSource.transaction(async (manager) => {
      const lockedLesson = await manager.findOne(Lesson, {
        where: { id: lessonId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedLesson) {
        throw new NotFoundException('Lesson not found');
      }
      if (lockedLesson.status === LessonStatus.CANCELLED) {
        return {
          changed: false,
          refundAmount: Number(lockedLesson.price),
        };
      }
      if (lockedLesson.status !== LessonStatus.CONFIRMED) {
        throw new BadRequestException('Lesson cannot be cancelled');
      }

      lockedLesson.status = LessonStatus.CANCELLED;
      lockedLesson.paymentStatus = LessonPaymentStatus.REFUNDED;
      await manager.save(Lesson, lockedLesson);

      await manager.increment(
        StudentProfile,
        { userId: lockedLesson.studentId },
        'balance',
        lockedLesson.price,
      );

      const fundingAllocations = await manager.find(LessonFundingAllocation, {
        where: { lessonId: lockedLesson.id },
        lock: { mode: 'pessimistic_write' },
      });
      for (const allocation of fundingAllocations) {
        await manager.decrement(
          Payment,
          { id: allocation.paymentId },
          'allocatedAmount',
          Number(allocation.amount),
        );
      }
      await manager.delete(LessonFundingAllocation, {
        lessonId: lockedLesson.id,
      });

      // Compatibility for lessons confirmed before earnings recognition was
      // moved to completion: reverse any tutor share already credited.
      if (lockedLesson.tutorShareReleasedAt) {
        const tutorShare =
          lockedLesson.tutorShare ??
          Math.max(
            0,
            Number(lockedLesson.price) - Number(lockedLesson.platformFee ?? 0),
          );
        if (tutorShare > 0) {
          await manager.decrement(
            TutorProfile,
            { userId: lockedLesson.tutorId },
            'balance',
            tutorShare,
          );
        }
      }

      await manager.update(Classroom, { lessonId }, { isActive: false });
      return {
        changed: true,
        refundAmount: Number(lockedLesson.price),
      };
    });

    if (!cancellation.changed) {
      const duplicate = await this.lessonRepository.findOne({
        where: { id: lessonId },
        relations: { tutor: true, student: true },
      });
      return {
        ...this.presentLesson(duplicate ?? lesson),
        refunded: true,
        refundAmount: cancellation.refundAmount,
        duplicate: true,
      };
    }

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
        paymentStatus: true,
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
    const refundAmount = cancellation.refundAmount;
    const wasRefunded = refundAmount > 0;
    const refundNote = wasRefunded
      ? `<p>A refund of $${refundAmount.toFixed(2)} has been credited to the student balance.</p>`
      : '<p>No refund was issued because this pending lesson had not been charged.</p>';
    const refundNoteAr = wasRefunded
      ? `<p>تمت إعادة $${refundAmount.toFixed(2)} إلى رصيد الطالب.</p>`
      : '<p>لم يصدر ردّ مالي لأن الدرس المعلّق لم يُخصم بعد.</p>';

    if (this.notificationRepository) {
      await this.notificationRepository.save([
        this.notificationRepository.create({
          userId: lesson.studentId,
          type: 'lesson_cancelled',
          title: 'Lesson cancelled',
          body: wasRefunded
            ? `The lesson was cancelled and $${refundAmount.toFixed(2)} was returned to your wallet.`
            : 'The lesson was cancelled.',
        }),
        this.notificationRepository.create({
          userId: lesson.tutorId,
          type: 'lesson_cancelled',
          title: 'Lesson cancelled',
          body: `The lesson with ${studentName} scheduled for ${scheduledLabel} was cancelled.`,
        }),
      ]);
    }

    if (lesson.tutor?.email) {
      this.emailService
        .sendEmail(
          lesson.tutor.email,
          'تم إلغاء الدرس | Lesson Cancelled — MRH Academy',
          `<div dir="rtl"><p>تم إلغاء درس.</p>
<p>الطالب: ${studentName}</p>
<p>الموعد: ${lesson.scheduledTime.toLocaleString('ar-EG')}</p>
${refundNoteAr}</div><hr><div dir="ltr"><p>A lesson has been cancelled.</p>
<p>Student: ${studentName}</p>
<p>Scheduled: ${scheduledLabel}</p>
${refundNote}</div>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    if (lesson.student?.email) {
      const studentRefundNote = wasRefunded
        ? `<p>$${refundAmount.toFixed(2)} has been refunded to your balance.</p>`
        : '<p>No refund was issued because this pending lesson had not been charged.</p>';
      const studentRefundNoteAr = wasRefunded
        ? `<p>تمت إعادة $${refundAmount.toFixed(2)} إلى رصيدك.</p>`
        : '<p>لم يصدر ردّ مالي لأن الدرس المعلّق لم يُخصم بعد.</p>';

      this.emailService
        .sendEmail(
          lesson.student.email,
          'تم إلغاء الدرس | Lesson Cancelled — MRH Academy',
          `<div dir="rtl"><p>تم إلغاء درسك.</p>
<p>المعلّم: ${tutorName}</p>
<p>الموعد: ${lesson.scheduledTime.toLocaleString('ar-EG')}</p>
${studentRefundNoteAr}</div><hr><div dir="ltr"><p>Your lesson has been cancelled.</p>
<p>Tutor: ${tutorName}</p>
<p>Scheduled: ${scheduledLabel}</p>
${studentRefundNote}</div>`,
        )
        .catch((err) => this.logger.error('Email delivery failed', err));
    }

    return {
      ...this.presentLesson(cancelled ?? lesson),
      refunded: wasRefunded,
      refundAmount,
      duplicate: false,
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
    const { lesson, access } = await this.classroomAccessService.findByRoomId(
      roomId,
      userId,
    );
    return {
      ...this.presentLesson(lesson),
      access,
    };
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
        paymentStatus: true,
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

  private presentLesson(lesson: Lesson) {
    const timezone = lesson.tutor?.timezone ?? 'UTC';
    return {
      id: lesson.id,
      tutorId: lesson.tutorId,
      studentId: lesson.studentId,
      scheduledTime: lesson.scheduledTime,
      endTime:
        lesson.endTime ??
        new Date(
          lesson.scheduledTime.getTime() + lesson.durationMinutes * 60_000,
        ),
      durationMinutes: lesson.durationMinutes,
      price: lesson.price,
      platformFee: lesson.platformFee,
      status: lesson.status,
      sessionStatus: lesson.status,
      paymentStatus:
        lesson.paymentStatus ??
        (lesson.status === LessonStatus.CANCELLED
          ? LessonPaymentStatus.REFUNDED
          : LessonPaymentStatus.PAID),
      timezone,
      roomId: lesson.roomId,
      meetUrl: lesson.meetUrl,
      googleMeetUrl: lesson.googleMeetUrl,
      notes: lesson.notes,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
      tutor: lesson.tutor
        ? {
            id: lesson.tutor.id,
            firstName: lesson.tutor.firstName,
            lastName: lesson.tutor.lastName,
            avatarUrl: lesson.tutor.avatarUrl,
          }
        : null,
      student: lesson.student
        ? {
            id: lesson.student.id,
            firstName: lesson.student.firstName,
            lastName: lesson.student.lastName,
            avatarUrl: lesson.student.avatarUrl,
          }
        : null,
    };
  }

  private assertMatchingBookingRetry(
    lesson: Lesson,
    studentId: string,
    dto: BookLessonDto,
  ): void {
    const requestedTime = new Date(dto.scheduledTime).getTime();
    const existingTime = new Date(lesson.scheduledTime).getTime();
    if (
      lesson.studentId !== studentId ||
      lesson.tutorId !== dto.tutorId ||
      lesson.durationMinutes !== dto.durationMinutes ||
      requestedTime !== existingTime
    ) {
      throw new BadRequestException(
        'Booking key is already in use for a different booking',
      );
    }
  }

  private timeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
  }

  private async assertWithinAvailability(
    tutorId: string,
    scheduledDate: Date,
    durationMinutes: number,
    timezone: string,
  ): Promise<void> {
    const slots = await this.availabilityRepository.find({
      where: { tutorId },
    });
    if (slots.length === 0) {
      throw new BadRequestException('Tutor has not set availability');
    }
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(scheduledDate);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      weekday ?? '',
    );
    const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    if (daySlots.length === 0) {
      throw new BadRequestException('Tutor is not available on this day');
    }
    const hours = Number(
      parts.find((part) => part.type === 'hour')?.value ?? 0,
    );
    const minutes = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );
    const startMin = hours * 60 + minutes;
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
