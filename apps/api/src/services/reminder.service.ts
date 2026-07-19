import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonStatus } from '@mrh/types';
import { Lesson } from '../entities/lesson.entity.js';
import { EmailService } from './email.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingLessons() {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const in61Minutes = new Date(now.getTime() + 61 * 60 * 1000);

    const lessons = await this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.tutor', 'tutor')
      .leftJoinAndSelect('lesson.student', 'student')
      .where('lesson.status = :status', { status: LessonStatus.CONFIRMED })
      .andWhere('lesson.scheduledTime > :start', { start: inOneHour })
      .andWhere('lesson.scheduledTime < :end', { end: in61Minutes })
      .getMany();

    this.logger.log(
      `Reminder cron: found ${lessons.length} upcoming lesson(s)`,
    );

    for (const lesson of lessons) {
      try {
        const key = `reminder:lesson:${lesson.id}`;
        // Atomic set-if-not-exists: returns 'OK' only if key was newly set
        const acquired = await this.redisService.setNX(key, '1', 7200);
        if (!acquired) continue;

        if (lesson.student?.email) {
          this.emailService
            .sendEmail(
              lesson.student.email,
              'Lesson Reminder — MRH Academy',
              `<p>Your lesson is starting in 1 hour!</p>
<p>Tutor: ${lesson.tutor?.firstName ?? 'Tutor'} ${lesson.tutor?.lastName ?? ''}</p>
<p>Time: ${lesson.scheduledTime.toLocaleString()}</p>
<p>Duration: ${lesson.durationMinutes} minutes</p>`,
            )
            .catch((err) =>
              this.logger.error(
                `Reminder email delivery failed for student ${lesson.student?.email}`,
                err instanceof Error ? err.stack : err,
              ),
            );
        }

        if (lesson.tutor?.email) {
          this.emailService
            .sendEmail(
              lesson.tutor.email,
              'Lesson Reminder — MRH Academy',
              `<p>Your lesson is starting in 1 hour!</p>
<p>Student: ${lesson.student?.firstName ?? 'Student'} ${lesson.student?.lastName ?? ''}</p>
<p>Time: ${lesson.scheduledTime.toLocaleString()}</p>
<p>Duration: ${lesson.durationMinutes} minutes</p>`,
            )
            .catch((err) =>
              this.logger.error(
                `Reminder email delivery failed for tutor ${lesson.tutor?.email}`,
                err instanceof Error ? err.stack : err,
              ),
            );
        }
      } catch (err) {
        // Don't let a single lesson failure crash the entire cron job
        this.logger.error(
          `Reminder failed for lesson ${lesson.id}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }
  }
}
