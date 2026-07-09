import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../services/gemini.service.js';
import { VocabularyWord } from '../entities/vocabulary-word.entity.js';

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

    const prompt = `You are a vocabulary tutor. For the word/phrase "${word}" (language: ${language}), provide a JSON response with exactly these fields:
{
  "word": "${word}",
  "pronunciation": "phonetic pronunciation",
  "definition": "clear definition in English",
  "examples": ["example sentence 1", "example sentence 2"],
  "translation": "Arabic translation of the word",
  "partOfSpeech": "noun/verb/adjective/etc"
}
Return ONLY valid JSON, no markdown formatting.`;

    const raw = await this.geminiService.generate(prompt);
    try {
      const cleaned = raw
        .replace(/```json?/gi, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return {
        word,
        definition: raw,
        examples: [],
        translation: '',
        pronunciation: '',
        partOfSpeech: '',
      };
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
