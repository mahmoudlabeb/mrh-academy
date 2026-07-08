import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { AdminEmployeesService } from './admin-employees.service.js';

@Controller('admin/employees')
export class AdminEmployeesController {
  constructor(private readonly employeesService: AdminEmployeesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_employees')
  getAllEmployees() {
    return this.employeesService.getAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  addEmployee(
    @Body()
    dto: {
      firstName: string;
      lastName: string;
      email: string;
      roleTitle: string;
      permissions: string[];
    },
  ) {
    return this.employeesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  updateEmployee(
    @Param('id') id: string,
    @Body()
    dto: {
      firstName?: string;
      lastName?: string;
      email?: string;
      roleTitle?: string;
      permissions?: string[];
    },
  ) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  deleteEmployee(@Param('id') id: string) {
    return this.employeesService.delete(id);
  }
}
