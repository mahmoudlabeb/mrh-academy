import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommissionService } from './commission.service.js';
import { Setting } from '../entities/setting.entity.js';

describe('CommissionService', () => {
  let service: CommissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        {
          provide: getRepositoryToken(Setting),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get(CommissionService);
  });

  describe('calculateLessonFee', () => {
    it('returns 30% for 0–20 hours', () => {
      expect(service.calculateLessonFee(0)).toBe(0.3);
      expect(service.calculateLessonFee(20)).toBe(0.3);
    });

    it('returns 24% for 21–50 hours', () => {
      expect(service.calculateLessonFee(21)).toBe(0.24);
      expect(service.calculateLessonFee(50)).toBe(0.24);
    });

    it('returns 20% for 51–200 hours', () => {
      expect(service.calculateLessonFee(51)).toBe(0.2);
      expect(service.calculateLessonFee(200)).toBe(0.2);
    });

    it('returns 18% for 201–400 hours', () => {
      expect(service.calculateLessonFee(201)).toBe(0.18);
      expect(service.calculateLessonFee(400)).toBe(0.18);
    });

    it('returns 12% for 400+ hours', () => {
      expect(service.calculateLessonFee(401)).toBe(0.12);
      expect(service.calculateLessonFee(1000)).toBe(0.12);
    });
  });

  describe('calculateLessonEarnings', () => {
    it('splits price correctly at tier boundary 20h', () => {
      const { platformFee, tutorShare } = service.calculateLessonEarnings(
        100,
        20,
      );
      expect(platformFee).toBe(30);
      expect(tutorShare).toBe(70);
    });

    it('splits price correctly at tier boundary 50h', () => {
      const { platformFee, tutorShare } = service.calculateLessonEarnings(
        100,
        50,
      );
      expect(platformFee).toBe(24);
      expect(tutorShare).toBe(76);
    });
  });
});
