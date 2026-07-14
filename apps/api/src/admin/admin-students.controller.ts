import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, LessonStatus } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { User } from '../entities/user.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Lesson } from '../entities/lesson.entity.js';

@Controller('admin/students')
export class AdminStudentsController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_students')
  async getAllStudents() {
    const students = await this.userRepository.find({
      where: { role: UserRole.STUDENT },
      relations: { studentProfile: true },
    });

    const result = await Promise.all(
      students.map(async (student) => {
        const lessonCount = await this.lessonRepository.count({
          where: { studentId: student.id },
        });
        const completedLessons = await this.lessonRepository.count({
          where: { studentId: student.id, status: LessonStatus.COMPLETED },
        });
        return {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phone: student.phone,
          avatarUrl: student.avatarUrl,
          isActive: student.isActive,
          isVerified: student.isVerified,
          createdAt: student.createdAt,
          balance: student.studentProfile?.balance ?? 0,
          preferredLanguage: student.studentProfile?.preferredLanguage ?? null,
          totalLessons: lessonCount,
          completedLessons,
        };
      }),
    );

    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_students')
  async getStudent(@Param('id') id: string) {
    const student = await this.userRepository.findOne({
      where: { id, role: UserRole.STUDENT },
      relations: { studentProfile: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  @Get(':id/lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_students')
  async getStudentLessons(@Param('id') id: string) {
    const lessons = await this.lessonRepository.find({
      where: { studentId: id },
      relations: { tutor: true, student: true },
      order: { createdAt: 'DESC' },
    });
    return lessons;
  }
}
