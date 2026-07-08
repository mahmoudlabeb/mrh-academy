import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomGateway } from './classroom.gateway.js';
import { Lesson } from '../entities/lesson.entity.js';

import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Lesson])],
  providers: [ClassroomGateway],
  exports: [ClassroomGateway],
})
export class ClassroomModule {}
