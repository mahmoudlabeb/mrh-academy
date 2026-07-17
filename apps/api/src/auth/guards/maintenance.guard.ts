import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Setting } from '../../entities/setting.entity.js';
import { UserRole } from '@mrh/types';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const setting = await this.dataSource
      .getRepository(Setting)
      .findOne({ where: { key: 'maintenance_mode' } });

    if (!setting || setting.value !== 'true') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.role === UserRole.ADMIN) {
      return true;
    }

    throw new ServiceUnavailableException(
      'System is under maintenance. Please try again later.',
    );
  }
}
