import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { VocabularyService } from './vocabulary.service.js';
import { DefineWordDto } from './dto/define-word.dto.js';

@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Post('define')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async defineWord(
    @CurrentUser() user: { id: string },
    @Body() dto: DefineWordDto,
  ) {
    return this.vocabularyService.defineWord(dto.word, dto.language);
  }

  @Post('save')
  async saveWord(
    @CurrentUser() user: { id: string },
    @Body()
    dto: {
      word: string;
      definition: string;
      examples?: string;
      translation?: string;
      language?: string;
      contextSentence?: string;
    },
  ) {
    return this.vocabularyService.saveWord(user.id, dto);
  }

  @Get()
  async listWords(@CurrentUser() user: { id: string }) {
    return this.vocabularyService.listWords(user.id);
  }

  @Delete(':id')
  async deleteWord(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.vocabularyService.deleteWord(user.id, id);
  }
}
