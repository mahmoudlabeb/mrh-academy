import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherTrainingArticle } from './entities/teacher-training-article.entity.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherTrainingArticle])],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
