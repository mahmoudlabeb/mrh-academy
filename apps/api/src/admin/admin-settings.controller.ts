import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Setting } from '../entities/setting.entity.js';
import { CommissionService } from '../services/commission.service.js';

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly commissionService: CommissionService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_settings')
  async getSettings() {
    const settings = await this.settingRepository.find();
    const result: Record<string, string> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    return result;
  }

  private async handleUpdate(
    dto: { key: string; value: string }[] | Record<string, string>,
  ) {
    if (Array.isArray(dto)) {
      for (const item of dto) {
        await this.settingRepository.upsert(
          { key: item.key, value: item.value },
          ['key'],
        );
      }
    } else {
      for (const [key, value] of Object.entries(dto)) {
        await this.settingRepository.upsert({ key, value }, ['key']);
      }
    }
    this.commissionService.invalidateCache();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_settings')
  async updateSettings(
    @Body() dto: { key: string; value: string }[] | Record<string, string>,
  ) {
    await this.handleUpdate(dto);
    return { message: 'Settings updated successfully' };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_settings')
  async putSettings(@Body() dto: Record<string, string>) {
    await this.handleUpdate(dto);
    return { message: 'Settings updated successfully' };
  }
}
