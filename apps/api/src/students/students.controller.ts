import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UserRole, LessonStatus, CourseStatus } from '@mrh/types';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StudentsService } from './students.service.js';
import { UsersService } from '../users/users.service.js';
import { UpdateProfileDto } from '../users/dto/update-profile.dto.js';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Review } from '../entities/review.entity.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly usersService: UsersService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getBalance(user.id);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('payment-history')
  getPaymentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getPaymentHistory(user.id);
  }

  @Get('payment-methods')
  getPaymentMethods(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getPaymentMethods(user.id);
  }

  @Get('combined-history')
  getCombinedHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getCombinedHistory(user.id);
  }

  @Get('lessons')
  async getLessons(@CurrentUser() user: AuthenticatedUser) {
    const lessons = await this.lessonRepository.find({
      where: { studentId: user.id },
      relations: { tutor: true },
      order: { scheduledTime: 'DESC' },
    });
    return lessons.map((l) => ({
      id: l.id,
      tutorName: l.tutor
        ? `${l.tutor.firstName} ${l.tutor.lastName}`
        : 'Unknown',
      subject: '',
      date: l.scheduledTime,
      duration: l.durationMinutes,
      price: l.price,
      status: l.status,
      roomId: l.meetUrl,
    }));
  }

  @Get('favorite-tutors')
  async getFavoriteTutors(@CurrentUser() user: AuthenticatedUser) {
    const lessons = await this.lessonRepository.find({
      where: { studentId: user.id },
      relations: { tutor: true },
    });
    const tutorIds = [
      ...new Set(lessons.map((l) => l.tutorId).filter(Boolean)),
    ];

    if (tutorIds.length === 0) return [];

    const tutors = await this.tutorProfileRepository.find({
      where: { userId: In(tutorIds), status: CourseStatus.APPROVED },
      relations: { user: true },
    });

    const result = await Promise.all(
      tutors.map(async (t) => {
        const avg = await this.reviewRepository
          .createQueryBuilder('review')
          .where('review.tutorId = :tutorId', { tutorId: t.userId })
          .andWhere('review.status = :status', {
            status: CourseStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();
        return {
          userId: t.userId,
          firstName: t.user?.firstName ?? '',
          lastName: t.user?.lastName ?? '',
          specialization: t.specialization,
          hourlyRate: t.hourlyRate,
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
        };
      }),
    );

    return result.sort((a, b) => b.averageRating - a.averageRating);
  }
}
