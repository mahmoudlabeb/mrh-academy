import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TutorsService } from './tutors.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { ApplyTutorDto, UpdateTutorDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { UserRole } from '@mrh/types';

@Controller('tutors')
export class TutorsController {
  constructor(
    private readonly tutorsService: TutorsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // --- PUBLIC ---

  @Public()
  @Get()
  findAllWithFilters(
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('languages') languages?: string,
    @Query('sort') sort?: 'asc' | 'desc',
    @Query('search') search?: string,
  ) {
    return this.tutorsService.findAllWithFilters({
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      languages,
      sort: sort || 'asc',
      search,
    });
  }

  @Public()
  @Get('top')
  getTopRated() {
    return this.tutorsService.findTopRated(3);
  }

  @Public()
  @Get(':id/availability')
  getPublicAvailability(@Param('id') id: string) {
    return this.availabilityService.findByTutor(id);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  async getPendingTutors() {
    return this.tutorsService.findAllPending();
  }

  @Public()
  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.tutorsService.findPublicProfile(id);
  }

  // --- TUTOR SELF-SERVICE ---

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.TUTOR)
  getMyProfile(@CurrentUser() user: { id: string }) {
    return this.tutorsService.findOneByUserId(user.id);
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.TUTOR)
  updateMyProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateTutorDto,
  ) {
    return this.tutorsService.updateTutorProfile(user.id, dto);
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  getMyStats(@CurrentUser() user: { id: string }) {
    return this.tutorsService.getTutorStats(user.id);
  }

  @Get('me/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  getMyStudents(@CurrentUser() user: { id: string }) {
    return this.tutorsService.getTutorStudents(user.id);
  }

  // --- APPLICATION ---

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('document', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async applyToBeTutor(
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyTutorDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.tutorsService.applyToBeTutor(user.id, dto, file);
  }

  // --- ADMIN ---

}
