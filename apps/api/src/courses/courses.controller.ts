import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { EnrollCourseDto } from './dto/enroll-course.dto.js';
import { BunnyService } from '../services/bunny.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly bunnyService: BunnyService,
  ) {}

  @Get()
  findAllApproved() {
    return this.coursesService.findAllApproved();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get(':id/lessons')
  findLessons(@Param('id') id: string) {
    return this.coursesService.findLessons(id);
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

  @Get(':id/stream-token')
  @UseGuards(JwtAuthGuard)
  async getStreamToken(@Param('id') id: string) {
    const course = await this.coursesService.findOne(id);
    if (!course.bunnyVideoId) {
      throw new NotFoundException('No video associated with this course');
    }
    return { token: this.bunnyService.generateSignedUrl(course.bunnyVideoId) };
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
}
