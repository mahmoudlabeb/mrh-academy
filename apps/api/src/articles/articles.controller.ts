import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { ArticlesService } from './articles.service.js';
import { CreateArticleDto, UpdateArticleDto } from './dto/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('teacher-training/articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(user.id, dto);
  }

  @Public()
  @Get()
  findAllPublished() {
    return this.articlesService.findAllPublished();
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.articlesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}
