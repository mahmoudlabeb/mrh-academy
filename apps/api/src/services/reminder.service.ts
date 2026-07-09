import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonStatus } from '@mrh/types';
import { Lesson } from '../entities/lesson.entity.js';
import { EmailService } from './email.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class ReminderService {
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

    for (const lesson of lessons) {
      const key = `reminder:lesson:${lesson.id}`;
      const alreadyReminded = await this.redisService.get(key);
      if (alreadyReminded) continue;

      await this.redisService.set(key, '1', 'EX', 7200); // Expiry in 2 hours

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
          .catch(() => {});
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
          .catch(() => {});
      }
    }
  }
}
