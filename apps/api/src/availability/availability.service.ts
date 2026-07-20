import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TutorAvailability } from '../tutors/entities/tutor-availability.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/index.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(TutorAvailability)
    private readonly availabilityRepository: Repository<TutorAvailability>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async checkOverlap(
    tutorId: string,
    dto: CreateAvailabilityDto | UpdateAvailabilityDto,
    excludeId?: string,
  ) {
    const existing = await this.availabilityRepository.find({
      where: { tutorId, dayOfWeek: dto.dayOfWeek! },
    });

    for (const slot of existing) {
      if (excludeId && slot.id === excludeId) continue;
      if (
        this.timesOverlap(
          slot.startTime,
          slot.endTime,
          dto.startTime!,
          dto.endTime!,
        )
      ) {
        throw new BadRequestException(
          'Time slot overlaps with an existing availability',
        );
      }
    }
  }

  private toMinutes(time: string): number {
    const parts = time.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    return (
      this.toMinutes(start1) < this.toMinutes(end2) &&
      this.toMinutes(start2) < this.toMinutes(end1)
    );
  }

  async create(tutorId: string, dto: CreateAvailabilityDto) {
    await this.checkOverlap(tutorId, dto);
    const availability = this.availabilityRepository.create({
      ...dto,
      tutorId,
    });
    return this.availabilityRepository.save(availability);
  }

  findByTutor(tutorId: string) {
    return this.availabilityRepository.find({
      where: { tutorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async update(id: string, tutorId: string, dto: UpdateAvailabilityDto) {
    const availability = await this.availabilityRepository.findOne({
      where: { id, tutorId },
    });
    if (!availability)
      throw new NotFoundException('Availability slot not found');
    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined
    ) {
      await this.checkOverlap(tutorId, { ...availability, ...dto }, id);
    }
    Object.assign(availability, dto);
    return this.availabilityRepository.save(availability);
  }

  async remove(id: string, tutorId: string) {
    const availability = await this.availabilityRepository.findOne({
      where: { id, tutorId },
    });
    if (!availability)
      throw new NotFoundException('Availability slot not found');
    return this.availabilityRepository.remove(availability);
  }

  async getTutorTimezone(
    tutorId: string,
  ): Promise<{ timezone: string } | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .select('user.timezone')
      .where('user.id = :id', { id: tutorId })
      .getRawOne();
    return user ? { timezone: user.timezone } : null;
  }

  private getDayName(dayOfWeek: number): string {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[dayOfWeek] || 'monday';
  }

  private getReferenceDateInTz(dayOfWeek: number, timezone: string): Date {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(now);

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const todayStr =
      parts.find((p) => p.type === 'weekday')?.value?.toLowerCase() || '';
    const currentDayOfWeek = dayMap[todayStr] ?? now.getDay();

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    let diff = dayOfWeek - currentDayOfWeek;
    if (diff < 0) diff += 7;

    const refUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day) + diff,
    );
    return new Date(refUtc);
  }

  convertSlot(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    fromTimezone: string,
    toTimezone: string,
  ): { dayOfWeek: number; startTime: string; endTime: string } {
    const refDate = this.getReferenceDateInTz(dayOfWeek, fromTimezone);
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);

    const startUtc = Date.UTC(
      refDate.getUTCFullYear(),
      refDate.getUTCMonth(),
      refDate.getUTCDate(),
      sH,
      sM,
    );
    const endUtc = Date.UTC(
      refDate.getUTCFullYear(),
      refDate.getUTCMonth(),
      refDate.getUTCDate(),
      eH,
      eM,
    );

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: toTimezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const startStr = fmt.format(new Date(startUtc));
    const endStr = fmt.format(new Date(endUtc));

    const startParts = startStr.split(', ');
    const endParts = endStr.split(', ');

    return {
      dayOfWeek: dayMap[startParts[0]?.toLowerCase()] ?? dayOfWeek,
      startTime: startParts[1] || startTime,
      endTime: endParts[1] || endTime,
    };
  }
}
