import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Lesson } from '../entities/lesson.entity.js';
import { User } from '../entities/user.entity.js';

@Controller('tutor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TUTOR)
export class TutorDashboardController {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  @Get('students')
  async getStudents(@CurrentUser() user: { id: string }) {
    const lessons = await this.lessonRepository.find({
      where: { tutorId: user.id },
      relations: { student: true },
      order: { scheduledTime: 'DESC' },
    });

    const seen = new Map<string, { user: User; lessonCount: number }>();
    for (const l of lessons) {
      if (!l.student) continue;
      if (!seen.has(l.studentId)) {
        seen.set(l.studentId, { user: l.student, lessonCount: 0 });
      }
      seen.get(l.studentId)!.lessonCount++;
    }

    return Array.from(seen.values()).map(({ user, lessonCount }) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lessonCount,
    }));
  }
}
