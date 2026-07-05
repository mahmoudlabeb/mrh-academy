import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { AvailabilityService } from './availability.service.js';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('tutor/availability')
@Roles(UserRole.TUTOR)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateAvailabilityDto) {
    return this.availabilityService.create(user.id, dto);
  }

  @Get()
  findMy(@CurrentUser() user: { id: string }) {
    return this.availabilityService.findByTutor(user.id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.availabilityService.remove(id, user.id);
  }
}
