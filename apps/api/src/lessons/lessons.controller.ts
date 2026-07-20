import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
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
import { CalendarService } from '../integrations/google/calendar.service.js';

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
  getMyLessons(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.lessonsService.findUserLessons(user.id, user.role, p, l);
  }

  @Post('book')
  @Roles(UserRole.STUDENT)
  bookLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BookLessonDto,
  ) {
    return this.lessonsService.bookLesson(user.id, dto);
  }

  @Get('by-room/:roomId')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  getLessonByRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.findByRoomId(roomId, user.id);
  }

  @Get(':id/ical')
  @Header('Content-Type', 'text/calendar')
  @Header('Content-Disposition', 'attachment; filename="lesson.ics"')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  async exportIcal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.exportIcal(id, user.id, this.calendarService);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  cancelLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.cancelLesson(id, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.TUTOR)
  approveLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.approveLesson(id, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.TUTOR)
  rejectLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.rejectLesson(id, user.id);
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
