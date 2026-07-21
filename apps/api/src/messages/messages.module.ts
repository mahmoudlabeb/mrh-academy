import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Notification } from './entities/notification.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { MessagesController } from './messages.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { MessagesService } from './messages.service.js';
import { MessagesGateway } from './messages.gateway.js';
import { LessonReminderService } from './lesson-reminder.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Lesson, User, Notification]),
    AuthModule,
  ],
  controllers: [MessagesController, NotificationsController],
  providers: [MessagesService, MessagesGateway, LessonReminderService],
  exports: [MessagesGateway],
})
export class MessagesModule {}
