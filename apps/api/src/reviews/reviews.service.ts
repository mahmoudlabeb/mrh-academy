import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseStatus, LessonStatus } from '@mrh/types';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity.js';
import { Review } from '../entities/review.entity.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  async create(studentId: string, dto: CreateReviewDto) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: dto.lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.studentId !== studentId) {
      throw new ForbiddenException('You can only review your own lessons');
    }
    if (lesson.status !== LessonStatus.COMPLETED) {
      throw new BadRequestException('Only completed lessons can be reviewed');
    }

    const review = this.reviewRepository.create({
      studentId,
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      rating: dto.rating,
      comment: dto.comment ?? null,
      status: CourseStatus.PENDING,
    });

    try {
      return await this.reviewRepository.save(review);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This lesson has already been reviewed');
      }
      throw error;
    }
  }

  findApprovedForTutor(tutorId: string) {
    return this.reviewRepository.find({
      where: { tutorId, status: CourseStatus.APPROVED },
      relations: { student: true },
      order: { createdAt: 'DESC' },
    });
  }

  findPending() {
    return this.reviewRepository.find({
      where: { status: CourseStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(id: string, dto: UpdateReviewStatusDto) {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.status = dto.status;
    return this.reviewRepository.save(review);
  }

  private isUniqueViolation(error: unknown) {
    return (
      Boolean(error) &&
      typeof error === 'object' &&
      (error as { code?: string }).code === '23505'
    );
  }
}
