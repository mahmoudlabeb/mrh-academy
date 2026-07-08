import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ReportsService } from './reports.service.js';

type AuthenticatedUser = { id: string; role: UserRole };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.reportsService.findAll();
  }
}
