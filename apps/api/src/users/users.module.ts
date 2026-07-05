import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, StudentProfile, Lesson, TutorProfile])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
