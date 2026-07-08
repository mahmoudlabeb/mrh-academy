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
import { CommissionService } from '../services/commission.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { EmailService } from '../services/email.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';

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
    private readonly commissionService: CommissionService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  async findUserLessons(userId: string, role: UserRole) {
    const where =
      role === UserRole.TUTOR
        ? { tutorId: userId }
        : { studentId: userId };

    return this.lessonRepository.find({
      where,
      relations: {
        tutor: true,
        student: true,
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

    const price = Math.round(
      (tutorProfile.hourlyRate * (dto.durationMinutes / 60)) * 100,
    ) / 100;

    const scheduledDate = new Date(dto.scheduledTime);
    const endTime = new Date(scheduledDate.getTime() + dto.durationMinutes * 60000);

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
        .setLock('pessimistic_write')
        .where(
          'lesson.status IN (:...activeStatuses)',
          { activeStatuses: [LessonStatus.PENDING, LessonStatus.CONFIRMED] },
        )
        .andWhere(
          '(lesson.tutorId = :tutorId OR lesson.studentId = :studentId)',
          { tutorId: dto.tutorId, studentId },
        )
        .andWhere('lesson.scheduledTime < :endTime', { endTime })
        .andWhere('lesson.endTime > :scheduledDate', { scheduledDate })
        .getCount();

      if (overlapping > 0) {
        throw new BadRequestException('Time slot conflicts with an existing lesson');
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
    });

    if (savedLesson?.tutor?.email) {
      this.emailService.sendEmail(
        savedLesson.tutor.email,
        'New Lesson Booked — MRH Academy',
        `<p>A new lesson has been booked with you.</p>
<p>Student: ${savedLesson.student?.firstName ?? 'Student'} ${savedLesson.student?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>`,
      ).catch(() => {});
    }

    if (savedLesson?.student?.email) {
      this.emailService.sendEmail(
        savedLesson.student.email,
        'Lesson Booking Confirmed — MRH Academy',
        `<p>Your lesson has been booked successfully.</p>
<p>Tutor: ${savedLesson.tutor?.firstName ?? 'Tutor'} ${savedLesson.tutor?.lastName ?? ''}</p>
<p>Scheduled: ${scheduledDate.toLocaleString()}</p>
<p>Duration: ${dto.durationMinutes} minutes</p>
<p>Price: $${price.toFixed(2)}</p>`,
      ).catch(() => {});
    }

    return savedLesson;
  }

  async completeLesson(lessonId: string, userId: string, dto?: CompleteLessonDto) {
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
    });

    await this.redisService.del(`lessons:user:${lesson.tutorId}`);
    await this.redisService.del(`lessons:user:${lesson.studentId}`);

    const completed = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });

    if (completed?.student?.email) {
      this.emailService.sendEmail(
        completed.student.email,
        'Lesson Completed — MRH Academy',
        `<p>Your lesson has been marked as completed.</p>
<p>Tutor: ${completed.tutor?.firstName ?? 'Tutor'} ${completed.tutor?.lastName ?? ''}</p>
<p>Price: $${lesson.price.toFixed(2)}</p>
<p>Platform Fee: $${platformFee.toFixed(2)}</p>`,
      ).catch(() => {});
    }

    return completed;
  }

  async cancelLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.studentId !== userId && lesson.tutorId !== userId) {
      throw new ForbiddenException('You are not a participant of this lesson');
    }
    if (lesson.status !== LessonStatus.CONFIRMED && lesson.status !== LessonStatus.PENDING) {
      throw new BadRequestException('Lesson cannot be cancelled');
    }

    await this.dataSource.transaction(async (manager) => {
      lesson.status = LessonStatus.CANCELLED;
      await manager.save(Lesson, lesson);

      await manager.increment(
        StudentProfile,
        { userId: lesson.studentId },
        'balance',
        lesson.price,
      );
    });

    await this.redisService.del(`lessons:user:${lesson.tutorId}`);
    await this.redisService.del(`lessons:user:${lesson.studentId}`);

    return this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
  }

  async exportIcal(lessonId: string, calendarService: CalendarService) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { tutor: true, student: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const tutorName = lesson.tutor ? `${lesson.tutor.firstName} ${lesson.tutor.lastName}` : 'Tutor';
    const studentName = lesson.student ? `${lesson.student.firstName} ${lesson.student.lastName}` : 'Student';

    return calendarService.generateIcs({
      summary: `Lesson: ${tutorName} & ${studentName}`,
      description: `Language lesson between ${tutorName} (tutor) and ${studentName} (student).`,
      start: lesson.scheduledTime,
      end: lesson.endTime || new Date(lesson.scheduledTime.getTime() + lesson.durationMinutes * 60000),
      location: lesson.meetUrl || '',
      uid: `lesson-${lesson.id}`,
    });
  }
}
