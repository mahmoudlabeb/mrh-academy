import { Module } from '@nestjs/common';
import { AdminTutorsController } from './admin-tutors.controller.js';
import { TutorsModule } from '../tutors/tutors.module.js';

@Module({
  imports: [TutorsModule],
  controllers: [AdminTutorsController],
})
export class AdminModule {}
