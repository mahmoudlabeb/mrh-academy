import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../integrations/ai/gemini.service.js';
import { VocabularyWord } from './entities/vocabulary-word.entity.js';

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(VocabularyWord)
    private readonly vocabRepository: Repository<VocabularyWord>,
    private readonly geminiService: GeminiService,
  ) {}

  async defineWord(word: string, language = 'en') {
    if (!this.geminiService.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI vocabulary service is not configured',
      );
    }

    const request = JSON.stringify({ word: word.trim(), language });
    const raw = await this.geminiService.generateJson(
      `Define the vocabulary item in this JSON data: ${request}`,
      {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          pronunciation: { type: 'STRING' },
          definition: { type: 'STRING' },
          examples: { type: 'ARRAY', items: { type: 'STRING' } },
          translation: { type: 'STRING' },
          partOfSpeech: { type: 'STRING' },
        },
        required: [
          'word',
          'pronunciation',
          'definition',
          'examples',
          'translation',
          'partOfSpeech',
        ],
      },
    );
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof parsed.word !== 'string' ||
        typeof parsed.pronunciation !== 'string' ||
        typeof parsed.definition !== 'string' ||
        !Array.isArray(parsed.examples) ||
        !parsed.examples.every((example) => typeof example === 'string') ||
        typeof parsed.translation !== 'string' ||
        typeof parsed.partOfSpeech !== 'string'
      ) {
        throw new Error('Invalid vocabulary response shape');
      }
      return {
        word: parsed.word.slice(0, 100),
        pronunciation: parsed.pronunciation.slice(0, 200),
        definition: parsed.definition.slice(0, 2000),
        examples: parsed.examples
          .slice(0, 5)
          .map((example) => example.slice(0, 500)),
        translation: parsed.translation.slice(0, 500),
        partOfSpeech: parsed.partOfSpeech.slice(0, 100),
      };
    } catch {
      throw new ServiceUnavailableException(
        'AI vocabulary response could not be validated',
      );
    }
  }

  async saveWord(
    userId: string,
    data: {
      word: string;
      definition: string;
      examples?: string;
      translation?: string;
      language?: string;
      contextSentence?: string;
    },
  ) {
    const entry = this.vocabRepository.create({ userId, ...data });
    return this.vocabRepository.save(entry);
  }

  async listWords(userId: string) {
    return this.vocabRepository.find({
      where: { userId },
      order: { savedAt: 'DESC' },
    });
  }

  async deleteWord(userId: string, id: string) {
    const word = await this.vocabRepository.findOne({ where: { id, userId } });
    if (!word) throw new NotFoundException('Vocabulary word not found');
    return this.vocabRepository.remove(word);
  }
}
