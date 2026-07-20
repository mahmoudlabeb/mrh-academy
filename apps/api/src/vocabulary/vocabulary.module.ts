import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyController } from './vocabulary.controller.js';
import { VocabularyService } from './vocabulary.service.js';
import { VocabularyWord } from './entities/vocabulary-word.entity.js';
import { GeminiService } from '../integrations/ai/gemini.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([VocabularyWord])],
  controllers: [VocabularyController],
  providers: [VocabularyService, GeminiService],
  exports: [VocabularyService],
})
export class VocabularyModule {}
