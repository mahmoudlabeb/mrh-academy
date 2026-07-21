import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { LessonStatus } from '@mrh/types';
import { Notification } from './entities/notification.entity.js';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class LessonReminderService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  /** Runs frequently, but the stable notification type makes this idempotent. */
  @Cron('*/10 * * * *')
  async sendTomorrowReminders() {
    const now = Date.now();
    const from = new Date(now + 23 * 60 * 60 * 1000);
    const to = new Date(now + 25 * 60 * 60 * 1000);
    const lessons = await this.lessonRepository.find({
      where: {
        status: LessonStatus.CONFIRMED,
        scheduledTime: Between(from, to),
      },
      select: { id: true, tutorId: true, studentId: true, scheduledTime: true },
    });

    for (const lesson of lessons) {
      const users = await this.userRepository.find({
        where: [{ id: lesson.tutorId }, { id: lesson.studentId }],
        select: { id: true, notificationPreferences: true },
      });
      for (const user of users) {
        if (user.notificationPreferences?.lesson_reminders === false) continue;
        const type = `lesson_reminder:${lesson.id}`;
        const exists = await this.notificationRepository.findOne({
          where: { userId: user.id, type },
        });
        if (exists) continue;
        await this.notificationRepository.save(
          this.notificationRepository.create({
            userId: user.id,
            type,
            title: 'Lesson reminder',
            body: `You have a lesson tomorrow at ${lesson.scheduledTime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`,
          }),
        );
      }
    }
  }
}
