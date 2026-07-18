import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StudentsService } from './students.service.js';
import { UsersService } from '../users/users.service.js';
import { UpdateProfileDto } from '../users/dto/update-profile.dto.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';
import { Lesson } from '../entities/lesson.entity.js';

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
      meetUrl: l.meetUrl,
      googleMeetUrl: l.googleMeetUrl,
    }));
  }

  @Get('favorite-tutors')
  getFavoriteTutors(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getFavoriteTutors(user.id);
  }

  @Post('favorites')
  addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddFavoriteDto,
  ) {
    return this.studentsService.addFavorite(user.id, dto.tutorId);
  }

  @Delete('favorites/:tutorId')
  removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tutorId') tutorId: string,
  ) {
    return this.studentsService.removeFavorite(user.id, tutorId);
  }
}
