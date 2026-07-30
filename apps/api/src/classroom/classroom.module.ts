import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomGateway } from './classroom.gateway.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Classroom } from './entities/classroom.entity.js';
import { ClassroomMessage } from './entities/classroom-message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { TurnCredentialsService } from '../classroom/turn-credentials.service.js';
import { TurnCredentialsController } from '../classroom/turn-credentials.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClassroomAccessService } from './classroom-access.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Lesson, Classroom, ClassroomMessage, User]),
  ],
  controllers: [TurnCredentialsController],
  providers: [ClassroomGateway, TurnCredentialsService, ClassroomAccessService],
  exports: [ClassroomGateway, ClassroomAccessService],
})
export class ClassroomModule {}
