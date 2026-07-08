import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, CourseStatus } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Review } from '../entities/review.entity.js';

@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_reviews')
  async getPendingReviews() {
    return this.reviewRepository.find({
      where: { status: CourseStatus.PENDING },
      relations: { student: true, tutor: true, lesson: true },
      order: { createdAt: 'DESC' },
    });
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_reviews')
  async approveReview(@Param('id') id: string) {
    await this.reviewRepository.update(id, {
      status: CourseStatus.APPROVED,
    });
    return { message: 'Review approved successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_reviews')
  async deleteReview(@Param('id') id: string) {
    await this.reviewRepository.delete(id);
    return { message: 'Review deleted successfully' };
  }
}
