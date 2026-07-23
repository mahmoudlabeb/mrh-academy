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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, CourseStatus } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Course } from '../courses/entities/course.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('admin/courses')
export class AdminCoursesController {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_courses')
  async getAllCourses() {
    const courses = await this.courseRepository.find({
      relations: { tutor: true },
      order: { createdAt: 'DESC' },
    });
    return courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      price: c.price,
      thumbnailUrl: c.thumbnailUrl,
      tutorName: c.tutor
        ? `${c.tutor.firstName} ${c.tutor.lastName}`
        : 'Unknown',
      isApproved: c.status === CourseStatus.APPROVED,
      status: c.status,
      createdAt: c.createdAt,
      videoQualityApprovedAt: c.videoQualityApprovedAt,
    }));
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
      status: CourseStatus.PENDING,
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
  async approveCourse(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body: { videoQualityApproved?: boolean },
  ) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (body.videoQualityApproved !== true) {
      throw new BadRequestException(
        'Video quality must be reviewed before approving the course',
      );
    }
    await this.courseRepository.update(id, {
      status: CourseStatus.APPROVED,
      videoQualityApprovedAt: new Date(),
      videoQualityApprovedBy: admin.id,
    });
    return { message: 'Course approved successfully' };
  }
}
