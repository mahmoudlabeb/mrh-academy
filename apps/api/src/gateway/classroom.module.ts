import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomGateway } from './classroom.gateway.js';
import { ClassroomState } from './classroom-state.service.js';
import { WhiteboardService } from './classroom-whiteboard.service.js';
import { ChatService } from './classroom-chat.service.js';
import { WebrtcService } from './classroom-webrtc.service.js';
import { HealthService } from './classroom-health.service.js';
import { Lesson } from '../entities/lesson.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { TurnCredentialsService } from '../classroom/turn-credentials.service.js';
import { TurnCredentialsController } from '../classroom/turn-credentials.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Lesson, Classroom, User])],
  controllers: [TurnCredentialsController],
  providers: [
    ClassroomGateway,
    ClassroomState,
    WhiteboardService,
    ChatService,
    WebrtcService,
    HealthService,
    TurnCredentialsService,
  ],
  exports: [ClassroomGateway],
})
export class ClassroomModule {}
