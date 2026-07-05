import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity.js';
import { TutorProfile } from './entities/tutor-profile.entity.js';
import { StudentProfile } from './entities/student-profile.entity.js';
import { SubAdminProfile } from './entities/sub-admin-profile.entity.js';
import { Setting } from './entities/setting.entity.js';
import { UserRole, CourseStatus } from '@mrh/types';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🌱 Starting Database Seeding...');

  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Dropping and recreating schema...');
    await dataSource.synchronize(true);
  }

  const defaultPassword = await bcrypt.hash('Password123!', 12);
  const userRepository = dataSource.getRepository(User);
  const tutorRepository = dataSource.getRepository(TutorProfile);
  const studentRepository = dataSource.getRepository(StudentProfile);
  const subAdminRepository = dataSource.getRepository(SubAdminProfile);
  const settingRepository = dataSource.getRepository(Setting);

  // 1. Create deterministic SYSTEM user for automated broadcasts
  const systemUser = userRepository.create({
    id: SYSTEM_USER_ID,
    email: 'system@mrhacademy.com',
    passwordHash: defaultPassword,
    firstName: 'System',
    lastName: 'Broadcast',
    role: UserRole.SYSTEM,
    isVerified: true,
    isActive: false,
  });
  await userRepository.save(systemUser);
  console.log('✅ SYSTEM user created.');

  // 2. Create Admin
  const admin = userRepository.create({
    email: 'admin@mrhacademy.com',
    passwordHash: defaultPassword,
    firstName: 'System',
    lastName: 'Admin',
    role: UserRole.ADMIN,
    isVerified: true,
  });
  await userRepository.save(admin);
  console.log('✅ Admin created.');

  // 3. Create 1 SubAdmin
  const subAdmin = userRepository.create({
    email: 'subadmin@mrhacademy.com',
    passwordHash: defaultPassword,
    firstName: 'Support',
    lastName: 'Agent',
    role: UserRole.SUBADMIN,
    isVerified: true,
  });
  await userRepository.save(subAdmin);
  const subAdminProfile = subAdminRepository.create({
    userId: subAdmin.id,
    assignedPermissions: ['manage_users', 'manage_tutors', 'view_reports'],
  });
  await subAdminRepository.save(subAdminProfile);
  console.log('✅ SubAdmin created.');

  // 4. Create 3 Tutors
  for (let i = 1; i <= 3; i++) {
    const tutor = userRepository.create({
      email: `tutor${i}@mrhacademy.com`,
      passwordHash: defaultPassword,
      firstName: `Tutor`,
      lastName: `${i}`,
      role: UserRole.TUTOR,
      isVerified: true,
    });
    await userRepository.save(tutor);
    const tutorProfile = tutorRepository.create({
      userId: tutor.id,
      bio: `I am an expert tutor ${i} with years of experience.`,
      specialization: 'Mathematics',
      languages: ['English', 'Arabic'],
      hourlyRate: 50 + i * 10,
      balance: 0,
      status: CourseStatus.APPROVED,
    });
    await tutorRepository.save(tutorProfile);
  }
  console.log('✅ 3 Tutors created.');

  // 5. Create 5 Students
  for (let i = 1; i <= 5; i++) {
    const student = userRepository.create({
      email: `student${i}@mrhacademy.com`,
      passwordHash: defaultPassword,
      firstName: `Student`,
      lastName: `${i}`,
      role: UserRole.STUDENT,
      isVerified: true,
    });
    await userRepository.save(student);
    const studentProfile = studentRepository.create({
      userId: student.id,
      balance: 100 * i, // give them some initial balance
      preferredLanguage: 'en',
    });
    await studentRepository.save(studentProfile);
  }
  console.log('✅ 5 Students created.');

  await settingRepository.save([
    settingRepository.create({ key: 'course_tutor_promo_rate', value: '0.02' }),
    settingRepository.create({
      key: 'course_academy_base_rate',
      value: '0.53',
    }),
    settingRepository.create({ key: 'maintenance_mode', value: 'false' }),
    settingRepository.create({ key: 'default_lesson_price', value: '50.00' }),
  ]);
  console.log('✅ System settings created.');

  console.log('🎉 Seeding completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seeding failed', err);
  process.exit(1);
});
