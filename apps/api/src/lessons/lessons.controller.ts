import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { LessonsService } from './lessons.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';
import { CalendarService } from '../services/calendar.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly calendarService: CalendarService,
  ) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  getMyLessons(@CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.findUserLessons(user.id, user.role);
  }

  @Post('book')
  @Roles(UserRole.STUDENT)
  bookLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BookLessonDto,
  ) {
    return this.lessonsService.bookLesson(user.id, dto);
  }

  @Get(':id/ical')
  @Header('Content-Type', 'text/calendar')
  @Header('Content-Disposition', 'attachment; filename="lesson.ics"')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  async exportIcal(@Param('id') id: string) {
    return this.lessonsService.exportIcal(id, this.calendarService);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  cancelLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.cancelLesson(id, user.id);
  }

  @Post(':id/complete')
  @Roles(UserRole.TUTOR)
  completeLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: CompleteLessonDto,
  ) {
    return this.lessonsService.completeLesson(id, user.id, dto);
  }
}
