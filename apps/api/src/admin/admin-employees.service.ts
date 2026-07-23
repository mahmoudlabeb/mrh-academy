import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { UserRole } from '@mrh/types';
import { Employee } from './entities/employee.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SubAdminProfile } from './entities/sub-admin-profile.entity.js';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../auth/password.js';

function resolveSubAdminPassword(config: ConfigService): string {
  const configured = config.get<string>('SUBADMIN_DEFAULT_PASSWORD')?.trim();
  if (configured) {
    return configured;
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('SUBADMIN_DEFAULT_PASSWORD must be set in production');
  }
  return randomBytes(12).toString('base64url');
}

type EmployeeDto = {
  firstName: string;
  lastName: string;
  email: string;
  roleTitle: string;
  permissions: string[];
};

// Support staff may help with student and tutor communication/workflows, but
// financial, settings, employee-management, reporting, and impersonation
// capabilities are intentionally reserved for full administrators.
const SUBADMIN_ALLOWED_PERMISSIONS = [
  'manage_tutors',
  'manage_students',
] as const;

function sanitizeSubAdminPermissions(permissions: string[]): string[] {
  const allowed = new Set<string>(SUBADMIN_ALLOWED_PERMISSIONS);
  return [
    ...new Set(permissions.filter((permission) => allowed.has(permission))),
  ];
}

@Injectable()
export class AdminEmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SubAdminProfile)
    private readonly subAdminRepository: Repository<SubAdminProfile>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private mapEmployee(employee: Employee) {
    const [firstName = '', ...rest] = employee.name.split(' ');
    const lastName = rest.join(' ');
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(employee.permissions) as string[];
    } catch {
      permissions = employee.permissions
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return {
      id: employee.id,
      email: employee.email,
      firstName,
      lastName,
      roleTitle: employee.roleTitle,
      permissions,
    };
  }

  async getAll() {
    const employees = await this.employeeRepository.find({
      order: { createdAt: 'DESC' },
    });
    return employees.map((e) => this.mapEmployee(e));
  }

  async create(dto: EmployeeDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const existingEmployee = await this.employeeRepository.findOne({
      where: { email },
    });
    if (existingEmployee) {
      throw new ConflictException('An employee with this email already exists');
    }

    const temporaryPassword = resolveSubAdminPassword(this.configService);
    const passwordHash = await hashPassword(temporaryPassword);
    const permissions = sanitizeSubAdminPermissions(dto.permissions);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.SUBADMIN,
        isVerified: true,
      });
      const savedUser = await manager.save(user);

      await manager.save(
        SubAdminProfile,
        manager.create(SubAdminProfile, {
          userId: savedUser.id,
          assignedPermissions: permissions,
        }),
      );

      const employee = manager.create(Employee, {
        name: `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim(),
        email,
        roleTitle: dto.roleTitle.trim(),
        permissions: JSON.stringify(permissions),
      });
      const savedEmployee = await manager.save(employee);

      return savedEmployee;
    });

    return {
      ...this.mapEmployee(result),
      temporaryPassword,
    };
  }

  async update(id: string, dto: Partial<EmployeeDto>) {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    const email = (dto.email ?? employee.email).trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (dto.email && dto.email.toLowerCase() !== employee.email.toLowerCase()) {
      const emailTaken = await this.userRepository.findOne({
        where: { email },
      });
      if (emailTaken && emailTaken.id !== user?.id) {
        throw new ConflictException('Email is already in use');
      }
    }

    if (dto.firstName || dto.lastName) {
      const [currentFirst = '', ...rest] = employee.name.split(' ');
      const currentLast = rest.join(' ');
      employee.name =
        `${dto.firstName ?? currentFirst} ${dto.lastName ?? currentLast}`.trim();
    }
    if (dto.email) employee.email = email;
    if (dto.roleTitle) employee.roleTitle = dto.roleTitle.trim();
    if (dto.permissions) {
      employee.permissions = JSON.stringify(
        sanitizeSubAdminPermissions(dto.permissions),
      );
    }

    await this.employeeRepository.save(employee);

    if (user) {
      if (dto.firstName) user.firstName = dto.firstName.trim();
      if (dto.lastName) user.lastName = dto.lastName.trim();
      if (dto.email) user.email = email;
      await this.userRepository.save(user);

      const profile = await this.subAdminRepository.findOne({
        where: { userId: user.id },
      });
      if (profile && dto.permissions) {
        profile.assignedPermissions = sanitizeSubAdminPermissions(
          dto.permissions,
        );
        await this.subAdminRepository.save(profile);
      }
    }

    return this.mapEmployee(employee);
  }

  async delete(id: string) {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    const user = await this.userRepository.findOne({
      where: { email: employee.email },
    });

    await this.employeeRepository.delete(id);

    if (user && user.role === UserRole.SUBADMIN) {
      await this.subAdminRepository.delete({ userId: user.id });
      user.isActive = false;
      await this.userRepository.save(user);
      await this.userRepository.softRemove(user);
    }

    return { message: 'Employee deleted successfully' };
  }
}
