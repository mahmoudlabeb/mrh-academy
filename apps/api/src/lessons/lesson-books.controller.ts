import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { LessonBooksService } from './lesson-books.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('lessons/:lessonId/books')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT, UserRole.TUTOR)
export class LessonBooksController {
  constructor(private readonly lessonBooksService: LessonBooksService) {}

  @Get()
  listBooks(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonBooksService.listBooks(lessonId, user.id);
  }

  @Post()
  @Roles(UserRole.TUTOR)
  @UseInterceptors(
    FileInterceptor('book', {
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          callback(
            new BadRequestException('Only PDF books are supported'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadBook(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Book file is required');
    }
    return this.lessonBooksService.uploadBook(lessonId, user.id, file, title);
  }

  @Get(':bookId/pages/:page')
  @Header('Content-Type', 'image/jpeg')
  @Header('Content-Disposition', 'inline')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('X-Book-Protected', 'view-only')
  async getBookPage(
    @Param('lessonId') lessonId: string,
    @Param('bookId') bookId: string,
    @Param('page', ParseIntPipe) page: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const buffer = await this.lessonBooksService.getBookPageBuffer(
      lessonId,
      bookId,
      page,
      user.id,
    );
    return new StreamableFile(buffer);
  }

  @Delete(':bookId')
  @Roles(UserRole.TUTOR)
  deleteBook(
    @Param('lessonId') lessonId: string,
    @Param('bookId') bookId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonBooksService.deleteBook(lessonId, bookId, user.id);
  }
}
