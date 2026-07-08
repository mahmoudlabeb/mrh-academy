import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { AvailabilityService } from './availability.service.js';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller()
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('tutor/availability')
  @Roles(UserRole.TUTOR)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAvailabilityDto) {
    return this.availabilityService.create(user.id, dto);
  }

  @Get('tutor/availability')
  @Roles(UserRole.TUTOR)
  findMy(@CurrentUser() user: { id: string }) {
    return this.availabilityService.findByTutor(user.id);
  }

  @Put('tutor/availability/:id')
  @Roles(UserRole.TUTOR)
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.update(id, user.id, dto);
  }

  @Delete('tutor/availability/:id')
  @Roles(UserRole.TUTOR)
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.availabilityService.remove(id, user.id);
  }

  @Public()
  @Get('tutors/:tutorId/availability')
  async getTutorAvailability(
    @Param('tutorId') tutorId: string,
    @Query('timezone') timezone?: string,
  ) {
    const slots = await this.availabilityService.findByTutor(tutorId);
    if (!timezone) return slots;

    const tutor = await this.availabilityService.getTutorTimezone(tutorId);
    const tutorTimezone = tutor?.timezone || 'UTC';

    return slots.map((slot) => {
      const converted = this.availabilityService.convertSlot(
        slot.dayOfWeek,
        slot.startTime,
        slot.endTime,
        tutorTimezone,
        timezone,
      );
      return { ...slot, ...converted };
    });
  }
}
