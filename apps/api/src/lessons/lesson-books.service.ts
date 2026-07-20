import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { LessonBook } from './entities/lesson-book.entity.js';
import { LessonsService } from './lessons.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../integrations/storage/object-storage.js';

const MAX_BOOK_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 300;

@Injectable()
export class LessonBooksService {
  constructor(
    @InjectRepository(LessonBook)
    private readonly lessonBookRepository: Repository<LessonBook>,
    private readonly lessonsService: LessonsService,
    private readonly configService: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private ensureCloudinaryConfigured() {
    const configured = Boolean(
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME') &&
      this.configService.get<string>('CLOUDINARY_API_KEY') &&
      this.configService.get<string>('CLOUDINARY_API_SECRET'),
    );
    if (!configured) {
      throw new BadRequestException(
        'Book upload is not available — Cloudinary is not configured',
      );
    }
  }

  private async assertLessonTutor(lessonId: string, userId: string) {
    const lesson = await this.lessonsService.findLessonForParticipant(
      lessonId,
      userId,
    );
    if (lesson.tutorId !== userId) {
      throw new ForbiddenException('Only the tutor can manage classroom books');
    }
    return lesson;
  }

  private async assertLessonParticipant(lessonId: string, userId: string) {
    return this.lessonsService.findLessonForParticipant(lessonId, userId);
  }

  async listBooks(lessonId: string, userId: string) {
    await this.assertLessonParticipant(lessonId, userId);
    const books = await this.lessonBookRepository.find({
      where: { lessonId },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        lessonId: true,
        title: true,
        pageCount: true,
        mimeType: true,
        createdAt: true,
        uploadedBy: true,
      },
    });
    return books;
  }

  async uploadBook(
    lessonId: string,
    tutorId: string,
    file: Express.Multer.File,
    title?: string,
  ) {
    this.ensureCloudinaryConfigured();
    await this.assertLessonTutor(lessonId, tutorId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Book file is required');
    }
    if (file.size > MAX_BOOK_BYTES) {
      throw new BadRequestException('Book file must be 20 MB or smaller');
    }
    const mime = file.mimetype || 'application/pdf';
    if (mime !== 'application/pdf') {
      throw new BadRequestException('Only PDF books are supported');
    }

    if (file.buffer.subarray(0, 4).toString() !== '%PDF') {
      throw new BadRequestException('Book content is not a valid PDF');
    }
    const upload = await this.storage.upload(file.buffer, {
      folder: 'mrh-academy/classroom-books',
      resourceType: 'image',
      accessMode: 'authenticated',
    });
    const pageCount = Math.min(upload.pages ?? 1, MAX_PAGES);
    const bookTitle =
      title?.trim() ||
      file.originalname?.replace(/\.pdf$/i, '') ||
      'Classroom Book';

    const book = this.lessonBookRepository.create({
      lessonId,
      uploadedBy: tutorId,
      title: bookTitle.slice(0, 255),
      cloudinaryPublicId: upload.publicId,
      pageCount,
      mimeType: mime,
    });

    return this.lessonBookRepository.save(book);
  }

  async deleteBook(lessonId: string, bookId: string, tutorId: string) {
    await this.assertLessonTutor(lessonId, tutorId);
    const book = await this.lessonBookRepository.findOne({
      where: { id: bookId, lessonId },
    });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    await this.lessonBookRepository.remove(book);

    try {
      await this.storage.destroy(book.cloudinaryPublicId, {
        resourceType: 'image',
      });
    } catch {
      // Object cleanup is best-effort after the database record is removed.
    }

    return { deleted: true };
  }

  async getBookPageBuffer(
    lessonId: string,
    bookId: string,
    page: number,
    userId: string,
  ): Promise<Buffer> {
    this.ensureCloudinaryConfigured();
    await this.assertLessonParticipant(lessonId, userId);

    const book = await this.lessonBookRepository.findOne({
      where: { id: bookId, lessonId },
    });
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    if (!Number.isInteger(page) || page < 1 || page > book.pageCount) {
      throw new BadRequestException('Invalid page number');
    }

    const signedUrl = this.storage.signedUrl(book.cloudinaryPublicId, {
      resourceType: 'image',
      transformation: [
        {
          page,
          fetch_format: 'jpg',
          quality: 'auto:good',
          flags: 'progressive',
        },
      ],
    });

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new NotFoundException('Book page could not be loaded');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
