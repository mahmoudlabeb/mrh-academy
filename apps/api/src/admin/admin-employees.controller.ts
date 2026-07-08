import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Employee } from '../entities/employee.entity.js';

@Controller('admin/employees')
export class AdminEmployeesController {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_employees')
  async getAllEmployees() {
    return this.employeeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  async addEmployee(
    @Body() dto: { name: string; email: string; roleTitle: string; permissions: string[] },
  ) {
    const employee = this.employeeRepository.create({
      name: dto.name,
      email: dto.email,
      roleTitle: dto.roleTitle,
      permissions: JSON.stringify(dto.permissions),
    });
    return this.employeeRepository.save(employee);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  async updateEmployee(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      email?: string;
      roleTitle?: string;
      permissions?: string[];
    },
  ) {
    const employee = await this.employeeRepository.findOne({
      where: { id },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (dto.name !== undefined) employee.name = dto.name;
    if (dto.email !== undefined) employee.email = dto.email;
    if (dto.roleTitle !== undefined) employee.roleTitle = dto.roleTitle;
    if (dto.permissions !== undefined)
      employee.permissions = JSON.stringify(dto.permissions);
    return this.employeeRepository.save(employee);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('manage_employees')
  async deleteEmployee(@Param('id') id: string) {
    await this.employeeRepository.delete(id);
    return { message: 'Employee deleted successfully' };
  }
}
