import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../entities/setting.entity.js';
import { CommissionService } from './commission.service.js';

describe('CommissionService', () => {
  let service: CommissionService;
  const settingRepository: Partial<Record<keyof Repository<Setting>, jest.Mock>> = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
      ],
    }).compile();

    service = module.get<CommissionService>(CommissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCreditPrice', () => {
    it('returns cached value when cache is valid', async () => {
      await service.getCreditPrice();
      await service.getCreditPrice();
      expect(settingRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('returns default price 15 when setting not found', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
      const price = await service.getCreditPrice();
      expect(price).toBe(15);
    });

    it('parses and returns setting value when found', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '25.50' });
      const price = await service.getCreditPrice();
      expect(price).toBe(25.5);
    });

    it('handles invalid setting value gracefully', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: 'invalid' });
      const price = await service.getCreditPrice();
      expect(price).toBe(15);
    });

    it('handles zero or negative setting value', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '0' });
      const price = await service.getCreditPrice();
      expect(price).toBe(15);
    });
  });

  describe('amountToCredits', () => {
    it('converts amount to credits using credit price', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '20' });
      const credits = await service.amountToCredits(100);
      expect(credits).toBe(5);
    });

    it('rounds to 2 decimal places', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '15' });
      const credits = await service.amountToCredits(37.5);
      expect(credits).toBe(2.5);
    });
  });

  describe('calculateLessonFee', () => {
    const cases = [
      { hours: 10, expected: 0.3 },
      { hours: 20, expected: 0.3 },
      { hours: 21, expected: 0.24 },
      { hours: 50, expected: 0.24 },
      { hours: 51, expected: 0.2 },
      { hours: 200, expected: 0.2 },
      { hours: 201, expected: 0.18 },
      { hours: 400, expected: 0.18 },
      { hours: 401, expected: 0.12 },
    ];

    cases.forEach(({ hours, expected }) => {
      it(`returns ${expected} for ${hours} hours`, () => {
        expect(service.calculateLessonFee(hours)).toBe(expected);
      });
    });
  });

  describe('calculateLessonEarnings', () => {
    it('calculates platform fee and tutor share correctly', () => {
      const result = service.calculateLessonEarnings(100, 10);
      expect(result.platformFee).toBe(30);
      expect(result.tutorShare).toBe(70);
    });

    it('handles decimal amounts', () => {
      const result = service.calculateLessonEarnings(50.5, 10);
      expect(result.platformFee).toBe(15.15);
      expect(result.tutorShare).toBe(35.35);
    });
  });

  describe('calculateCourseFee', () => {
    it('returns tutor promo rate when sold by tutor', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '0.05' });
      const fee = await service.calculateCourseFee('tutor');
      expect(fee).toBe(0.05);
    });

    it('returns academy base rate when sold by academy', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValueOnce({ value: '0.5' });
      const fee = await service.calculateCourseFee('academy');
      expect(fee).toBe(0.5);
    });
  });

  describe('invalidateCache', () => {
    it('clears all cached values', async () => {
      (settingRepository.findOne as jest.Mock).mockResolvedValue({ value: '10' });
      await service.getCreditPrice();
      await service.getCourseTutorPromoRate();
      await service.getCourseAcademyBaseRate();

      service.invalidateCache();

      await service.getCreditPrice();
      await service.getCourseTutorPromoRate();
      await service.getCourseAcademyBaseRate();

      expect(settingRepository.findOne).toHaveBeenCalledTimes(6);
    });
  });
});