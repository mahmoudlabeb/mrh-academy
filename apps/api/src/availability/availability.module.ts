import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorAvailability } from '../entities/tutor-availability.entity.js';
import { User } from '../entities/user.entity.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TutorAvailability, User])],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
