import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TutorAvailability } from '../entities/tutor-availability.entity.js';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/index.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(TutorAvailability)
    private readonly availabilityRepository: Repository<TutorAvailability>,
  ) {}

  private async checkOverlap(tutorId: string, dto: CreateAvailabilityDto | UpdateAvailabilityDto, excludeId?: string) {
    const existing = await this.availabilityRepository.find({
      where: { tutorId, dayOfWeek: dto.dayOfWeek! },
    });

    for (const slot of existing) {
      if (excludeId && slot.id === excludeId) continue;
      if (this.timesOverlap(slot.startTime, slot.endTime, dto.startTime!, dto.endTime!)) {
        throw new BadRequestException('Time slot overlaps with an existing availability');
      }
    }
  }

  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    return start1 < end2 && start2 < end1;
  }

  async create(tutorId: string, dto: CreateAvailabilityDto) {
    await this.checkOverlap(tutorId, dto);
    const availability = this.availabilityRepository.create({ ...dto, tutorId });
    return this.availabilityRepository.save(availability);
  }

  findByTutor(tutorId: string) {
    return this.availabilityRepository.find({
      where: { tutorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async update(id: string, tutorId: string, dto: UpdateAvailabilityDto) {
    const availability = await this.availabilityRepository.findOne({ where: { id, tutorId } });
    if (!availability) throw new NotFoundException('Availability slot not found');
    if (dto.dayOfWeek !== undefined || dto.startTime !== undefined || dto.endTime !== undefined) {
      await this.checkOverlap(
        tutorId,
        { ...availability, ...dto } as CreateAvailabilityDto,
        id,
      );
    }
    Object.assign(availability, dto);
    return this.availabilityRepository.save(availability);
  }

  async remove(id: string, tutorId: string) {
    const availability = await this.availabilityRepository.findOne({ where: { id, tutorId } });
    if (!availability) throw new NotFoundException('Availability slot not found');
    return this.availabilityRepository.remove(availability);
  }
}
