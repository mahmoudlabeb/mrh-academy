import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { User } from '../entities/user.entity.js';
import { Notification } from '../entities/notification.entity.js';
import { MessagesController } from './messages.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Lesson, User, Notification])],
  controllers: [MessagesController, NotificationsController],
  providers: [MessagesService],
})
export class MessagesModule {}
