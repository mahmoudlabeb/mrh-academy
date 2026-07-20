import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherTrainingArticle } from './entities/teacher-training-article.entity.js';
import { CreateArticleDto, UpdateArticleDto } from './dto/index.js';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(TeacherTrainingArticle)
    private readonly articleRepository: Repository<TeacherTrainingArticle>,
  ) {}

  async create(authorId: string, dto: CreateArticleDto) {
    const article = this.articleRepository.create({
      title: dto.title,
      content: dto.content,
      coverImageUrl: dto.coverImageUrl ?? undefined,
      isPublished: dto.isPublished ?? false,
      authorId,
    });
    return this.articleRepository.save(article);
  }

  findAllPublished() {
    return this.articleRepository.find({
      where: { isPublished: true },
      order: { createdAt: 'DESC' },
      relations: { author: true },
    });
  }

  findAll() {
    return this.articleRepository.find({
      order: { createdAt: 'DESC' },
      relations: { author: true },
    });
  }

  async findOne(id: string) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async update(id: string, dto: UpdateArticleDto) {
    const article = await this.findOne(id);
    Object.assign(article, dto);
    return this.articleRepository.save(article);
  }

  async remove(id: string) {
    const article = await this.findOne(id);
    return this.articleRepository.remove(article);
  }
}
