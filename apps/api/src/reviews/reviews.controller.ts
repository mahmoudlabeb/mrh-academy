import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto.js';
import { ReviewsService } from './reviews.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.id, dto);
  }

  @Public()
  @Get('tutor/:tutorId')
  getApprovedForTutor(@Param('tutorId') tutorId: string) {
    return this.reviewsService.findApprovedForTutor(tutorId);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  getPending() {
    return this.reviewsService.findPending();
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateStatus(id, dto);
  }
}
