import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { EnrollCourseDto } from './dto/enroll-course.dto.js';
import { BunnyService } from '../integrations/video/bunny.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly bunnyService: BunnyService,
  ) {}

  @Public()
  @Get()
  findAllApproved() {
    return this.coursesService.findAllApproved();
  }

  @Get('my/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  myEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getEnrollments(user.id);
  }

  @Get('my/courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  myCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getMyCourses(user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get(':id/lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN, UserRole.SUBADMIN)
  findLessons(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findLessons(id, user.id, user.role);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user.id, dto);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto?: EnrollCourseDto,
  ) {
    return this.coursesService.enroll(user.id, id, dto);
  }

  @Post(':courseId/lessons/:lessonId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  completeLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.markLessonComplete(user.id, courseId, lessonId);
  }

  @Get(':id/stream-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  async getStreamToken(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const course = await this.coursesService.findOne(id, user.id, user.role);
    if (user.role === UserRole.STUDENT) {
      await this.coursesService.assertEnrollment(user.id, id);
    } else if (user.role === UserRole.TUTOR && course.tutorId !== user.id) {
      throw new NotFoundException('No video associated with this course');
    }
    if (!course.bunnyVideoId) {
      throw new NotFoundException('No video associated with this course');
    }
    return { token: this.bunnyService.generateSignedUrl(course.bunnyVideoId) };
  }
}
