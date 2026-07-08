import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { TutorsService } from '../tutors/tutors.service.js';
import { Lesson } from '../entities/lesson.entity.js';
import { User } from '../entities/user.entity.js';

@Controller('admin')
export class AdminStatsController {
  constructor(
    private readonly tutorsService: TutorsService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  getStats() {
    return this.tutorsService.getAdminStats();
  }

  @Get('stats/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  getDashboardStats() {
    return this.tutorsService.getAdminStats();
  }

  @Get('activity/recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async getRecentActivity() {
    const lessons = await this.lessonRepository.find({
      relations: { tutor: true, student: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      type: 'lesson',
      description: `Lesson: ${lesson.tutor?.firstName ?? 'Tutor'} ${lesson.tutor?.lastName ?? ''} with ${lesson.student?.firstName ?? 'Student'} ${lesson.student?.lastName ?? ''}`,
      user: lesson.tutor?.firstName ?? 'System',
      createdAt: lesson.createdAt,
    }));
  }
}
