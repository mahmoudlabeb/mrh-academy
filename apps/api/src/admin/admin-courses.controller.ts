import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseLifecycleStatus, UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Course } from '../courses/entities/course.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CourseReviewService } from './course-review.service.js';
import { ApproveCourseSubmissionDto } from './dto/approve-course-submission.dto.js';
import { RejectCourseSubmissionDto } from './dto/reject-course-submission.dto.js';

@Controller('admin/courses')
export class AdminCoursesController {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly courseReviewService: CourseReviewService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_courses')
  async getAllCourses(@Query('status') status?: string) {
    if (
      status &&
      !Object.values(CourseLifecycleStatus).includes(
        status as CourseLifecycleStatus,
      )
    ) {
      throw new BadRequestException('Invalid course lifecycle status');
    }
    return this.courseReviewService.list(status as CourseLifecycleStatus);
  }

  @Get(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_courses')
  getCourseReview(@Param('id') id: string) {
    return this.courseReviewService.getDetails(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async addCourse(
    @Body()
    dto: {
      tutorId: string;
      title: string;
      description: string;
      price: number;
      thumbnailUrl?: string;
    },
  ) {
    const course = this.courseRepository.create({
      tutorId: dto.tutorId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      thumbnailUrl: dto.thumbnailUrl,
      status: CourseLifecycleStatus.DRAFT,
      isDraft: true,
    });
    return this.courseRepository.save(course);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCourse(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      description?: string;
      price?: number;
      thumbnailUrl?: string;
    },
  ) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (dto.title !== undefined) course.title = dto.title;
    if (dto.description !== undefined) course.description = dto.description;
    if (dto.price !== undefined) course.price = dto.price;
    if (dto.thumbnailUrl !== undefined) course.thumbnailUrl = dto.thumbnailUrl;
    return this.courseRepository.save(course);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCourse(@Param('id') id: string) {
    await this.courseRepository.delete(id);
    return { message: 'Course deleted successfully' };
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_courses')
  async approveCourse(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: ApproveCourseSubmissionDto,
  ) {
    return this.courseReviewService.approve(id, admin.id, dto);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_courses')
  rejectCourse(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: RejectCourseSubmissionDto,
  ) {
    return this.courseReviewService.reject(id, admin.id, dto.reason);
  }
}
