import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';

@Controller('admin/lessons')
export class AdminLessonsController {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_lessons')
  async getAllLessons() {
    const lessons = await this.lessonRepository.find({
      relations: { tutor: true, student: true },
      order: { createdAt: 'DESC' },
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      tutorName: lesson.tutor
        ? `${lesson.tutor.firstName} ${lesson.tutor.lastName}`
        : null,
      studentName: lesson.student
        ? `${lesson.student.firstName} ${lesson.student.lastName}`
        : null,
      scheduledTime: lesson.scheduledTime,
      endTime: lesson.endTime,
      durationMinutes: lesson.durationMinutes,
      price: lesson.price,
      platformFee: lesson.platformFee,
      status: lesson.status,
      meetUrl: lesson.meetUrl,
      createdAt: lesson.createdAt,
    }));
  }
}
