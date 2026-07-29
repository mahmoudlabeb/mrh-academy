import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@mrh/types';
import { Employee } from './entities/employee.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SubAdminProfile } from './entities/sub-admin-profile.entity.js';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../integrations/email/email.service.js';

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
    private readonly emailService: EmailService,
  ) {}

  private mapEmployee(employee: Employee) {
    const legacyParts = (employee.name ?? '').split(' ');
    const firstName = employee.firstName || legacyParts.shift() || '';
    const lastName = employee.lastName || legacyParts.join(' ');
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

    const inviteToken = randomUUID();
    const inviteTokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const permissions = sanitizeSubAdminPermissions(dto.permissions);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email,
        passwordHash: null,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.SUBADMIN,
        isVerified: false,
        inviteToken,
        inviteTokenExpires,
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
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        roleTitle: dto.roleTitle.trim(),
        permissions: JSON.stringify(permissions),
      });
      const savedEmployee = await manager.save(employee);

      return savedEmployee;
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    await this.emailService.sendEmail(
      email,
      'دعوة إلى إدارة MRH | You are invited to MRH Academy administration',
      `<div dir="rtl"><p>تم إنشاء حساب إداري لك.</p>
<p><a href="${frontendUrl}/invite/accept?token=${encodeURIComponent(inviteToken)}">اختر كلمة المرور واقبل الدعوة</a>.</p>
<p>تنتهي صلاحية الدعوة خلال 48 ساعة.</p></div>
<hr>
<div dir="ltr"><p>An administrator account has been created for you.</p>
<p><a href="${frontendUrl}/invite/accept?token=${encodeURIComponent(inviteToken)}">Choose your password and accept the invitation</a>.</p>
<p>This invitation expires in 48 hours.</p></div>`,
    );

    return this.mapEmployee(result);
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
      employee.firstName = (dto.firstName ?? employee.firstName).trim();
      employee.lastName = (dto.lastName ?? employee.lastName).trim();
      employee.name = `${employee.firstName} ${employee.lastName}`.trim();
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
