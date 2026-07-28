import { BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const availabilityRepository = {
    find: jest.fn(async () => []),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const userRepository = {};

  let service: AvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AvailabilityService(
      availabilityRepository as never,
      userRepository as never,
    );
  });

  it('rejects an availability range whose end is not after its start', async () => {
    await expect(
      service.create('tutor-1', {
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '09:00',
        isRecurring: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(availabilityRepository.find).not.toHaveBeenCalled();
    expect(availabilityRepository.save).not.toHaveBeenCalled();
  });

  it('accepts a valid chronological availability range', async () => {
    await expect(
      service.create('tutor-1', {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isRecurring: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        tutorId: 'tutor-1',
        startTime: '09:00',
        endTime: '18:00',
      }),
    );

    expect(availabilityRepository.save).toHaveBeenCalledTimes(1);
  });
});
