import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { ReportsService } from '../reports/reports.service.js';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUBADMIN)
@RequirePermissions('view_reports')
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getAllReports(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.reportsService.findAll(
      limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50,
      offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0,
    );
    return {
      ...result,
      data: result.data.map((r) => ({
        id: r.id,
        reporterName: r.user
          ? `${r.user.firstName} ${r.user.lastName}`
          : 'Unknown',
        reporterEmail: r.user?.email ?? '',
        issueType: r.issueType,
        description: r.description,
        createdAt: r.createdAt,
      })),
    };
  }
}
