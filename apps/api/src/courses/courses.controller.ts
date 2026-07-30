import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { CreateCourseDraftDto } from './dto/create-course-draft.dto.js';
import { EnrollCourseDto } from './dto/enroll-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { UpsertCourseLessonDto } from './dto/upsert-course-lesson.dto.js';
import { BunnyService } from '../integrations/video/bunny.service.js';
import { UploadRateGuard } from '../common/guards/upload-rate.guard.js';
import {
  MAX_CAPTION_BYTES,
  MAX_SECURE_VIDEO_BYTES,
} from '../integrations/video/video-upload.validation.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly bunnyService: BunnyService,
  ) {}

  @Public()
  @Get()
  findAllApproved(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 24));
    return this.coursesService.findAllApproved(parsedPage, parsedLimit);
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

  @Get('my/referral-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  referralStats(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getTutorReferralStats(user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Public()
  @Get(':id/overview/playback')
  getPublicOverview(@Param('id') id: string) {
    return this.coursesService.getPublicCourseOverview(id);
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

  @Post('drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDraftDto,
  ) {
    return this.coursesService.createDraft(user.id, dto.courseType);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.updateOwnedCourse(user.id, id, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  submitForReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coursesService.submitForReview(user.id, id);
  }

  @Post(':id/media/:kind')
  @UseGuards(JwtAuthGuard, RolesGuard, UploadRateGuard)
  @Roles(UserRole.TUTOR)
  @UseInterceptors(
    FileInterceptor('media', {
      limits: { fileSize: MAX_SECURE_VIDEO_BYTES },
    }),
  )
  uploadMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (kind !== 'cover' && kind !== 'preview') {
      throw new BadRequestException('Media kind must be cover or preview');
    }
    return this.coursesService.uploadOwnedCourseMedia(user.id, id, kind, file);
  }

  @Get(':id/media/preview/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  getOverviewStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coursesService.getOwnedCourseOverview(user.id, id);
  }

  @Delete(':id/media/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  deleteOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coursesService.deleteOwnedCourseOverview(user.id, id);
  }

  @Post(':id/media/preview/captions')
  @UseGuards(JwtAuthGuard, RolesGuard, UploadRateGuard)
  @Roles(UserRole.TUTOR)
  @UseInterceptors(
    FileInterceptor('captions', {
      limits: { fileSize: MAX_CAPTION_BYTES },
    }),
  )
  uploadOverviewCaptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('language') language: string | undefined,
    @Body('label') label: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.uploadOwnedCourseOverviewCaption(
      user.id,
      id,
      file,
      language,
      label,
    );
  }

  @Delete(':id/media/preview/captions/:language')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  deleteOverviewCaptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('language') language: string,
  ) {
    return this.coursesService.deleteOwnedCourseOverviewCaption(
      user.id,
      id,
      language,
    );
  }

  @Post(':id/lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  addLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertCourseLessonDto,
  ) {
    return this.coursesService.addLesson(user.id, id, dto);
  }

  @Patch(':courseId/lessons/:lessonId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  updateLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertCourseLessonDto,
  ) {
    return this.coursesService.updateLesson(user.id, courseId, lessonId, dto);
  }

  @Delete(':courseId/lessons/:lessonId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  removeLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.removeLesson(user.id, courseId, lessonId);
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
    const playback = this.bunnyService.generateEmbedUrl(course.bunnyVideoId);
    return { embedUrl: playback.url, expiresAt: playback.expiresAt };
  }
}
