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
import { Employee } from './entities/employee.entity.js';
import { Course } from './entities/course.entity.js';
import { TutorAvailability } from './entities/tutor-availability.entity.js';
import { UserRole, CourseStatus } from '@mrh/types';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Starting Database Seeding...');

  if (process.env.NODE_ENV !== 'production') {
    if (process.env.CONFIRM_SEED !== 'yes') {
      console.error(
        'Refusing to run seed: set CONFIRM_SEED=yes to allow schema drop in non-production.',
      );
      process.exit(1);
    }
    console.log('Dropping and recreating schema...');
    await dataSource.synchronize(true);
  }

  const defaultPassword = await bcrypt.hash('123456', 12);
  const userRepository = dataSource.getRepository(User);
  const tutorRepository = dataSource.getRepository(TutorProfile);
  const studentRepository = dataSource.getRepository(StudentProfile);
  const subAdminRepository = dataSource.getRepository(SubAdminProfile);
  const settingRepository = dataSource.getRepository(Setting);
  const employeeRepository = dataSource.getRepository(Employee);
  const courseRepository = dataSource.getRepository(Course);
  const availabilityRepository = dataSource.getRepository(TutorAvailability);

  // Helper: upsert user by email, always resetting password to default
  async function upsertUser(data: Partial<User> & { email: string }): Promise<User> {
    const existing = await userRepository.findOne({ where: { email: data.email } });
    if (existing) {
      await userRepository.update(existing.id, { ...data, passwordHash: defaultPassword });
      return { ...existing, ...data, passwordHash: defaultPassword } as User;
    }
    const user = userRepository.create({ ...data, passwordHash: defaultPassword });
    return userRepository.save(user);
  }

  // 1. SYSTEM user
  const systemUser = await upsertUser({
    id: SYSTEM_USER_ID,
    email: 'system@mrhacademy.com',
    firstName: 'System',
    lastName: 'Broadcast',
    role: UserRole.SYSTEM,
    isVerified: true,
    isActive: false,
  });
  console.log('SYSTEM user upserted.');

  // 2. Admin (المدير العام)
  await upsertUser({
    email: 'admin@mrhacademy.com',
    firstName: 'المدير',
    lastName: 'العام',
    role: UserRole.ADMIN,
    isVerified: true,
  });
  console.log('Admin upserted (admin@mrhacademy.com).');

  // 3. Owner (fekrah23451@gmail.com — مدير الموقع)
  await upsertUser({
    email: 'fekrah23451@gmail.com',
    firstName: 'مدير',
    lastName: 'الموقع',
    role: UserRole.ADMIN,
    isVerified: true,
  });
  console.log('Owner upserted (fekrah23451@gmail.com).');

  // 4. Demo Student (student@demo.com)
  const demoStudent = await upsertUser({
    email: 'student@demo.com',
    firstName: 'Demo',
    lastName: 'Student',
    role: UserRole.STUDENT,
    isVerified: true,
    avatarUrl: 'https://randomuser.me/api/portraits/men/45.jpg',
  });
  const existingDemoProfile = await studentRepository.findOne({ where: { userId: demoStudent.id } });
  if (!existingDemoProfile) {
    await studentRepository.save(
      studentRepository.create({
        userId: demoStudent.id,
        balance: 50,
        preferredLanguage: 'ar',
      }),
    );
  }
  console.log('Demo Student upserted (student@demo.com, balance $50).');

  // 5. Student with $50 balance (موسيقا عميقة)
  const hkStudent = await upsertUser({
    email: 'hkprivat50@gmail.com',
    firstName: 'موسيقا',
    lastName: 'عميقة',
    role: UserRole.STUDENT,
    isVerified: true,
  });
  const existingHkProfile = await studentRepository.findOne({ where: { userId: hkStudent.id } });
  if (!existingHkProfile) {
    await studentRepository.save(
      studentRepository.create({
        userId: hkStudent.id,
        balance: 50,
        preferredLanguage: 'ar',
      }),
    );
  }
  console.log('Student upserted (hkprivat50@gmail.com, balance $50).');

  // 6. Tutor Sarah (English)
  const sarahUser = await upsertUser({
    email: 'Sarah.alazzeh87@gmail.com',
    firstName: 'Sarah',
    lastName: 'Alazzeh',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  const existingSarah = await tutorRepository.findOne({ where: { userId: sarahUser.id } });
  if (!existingSarah) {
    await tutorRepository.save(
      tutorRepository.create({
        userId: sarahUser.id,
        bio: 'Experienced English tutor specializing in conversation and IELTS preparation.',
        specialization: 'English',
        languages: ['English', 'Arabic'],
        hourlyRate: 60,
        balance: 0,
        totalHoursTaught: 150,
        status: CourseStatus.APPROVED,
      }),
    );
  }
  console.log('Tutor Sarah upserted (Sarah.alazzeh87@gmail.com).');

  // 7. Tutor Yasmeen (Arabic)
  const yasmeenUser = await upsertUser({
    email: 'yasmenaiman1@gmail.com',
    firstName: 'Yasmeen',
    lastName: 'Ayman',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  const existingYasmeen = await tutorRepository.findOne({ where: { userId: yasmeenUser.id } });
  if (!existingYasmeen) {
    await tutorRepository.save(
      tutorRepository.create({
        userId: yasmeenUser.id,
        bio: 'متخصصة في تدريس العربية الفصحى لغير الناطقين بها.',
        specialization: 'Arabic',
        languages: ['Arabic', 'English'],
        hourlyRate: 50,
        balance: 0,
        totalHoursTaught: 200,
        status: CourseStatus.APPROVED,
      }),
    );
  }
  console.log('Tutor Yasmeen upserted (yasmenaiman1@gmail.com).');

  // 8. Tutor Fatimetou (Arabic)
  const fatimaUser = await upsertUser({
    email: 'fatimetouzehra27@gmail.com',
    firstName: 'Fatimetou',
    lastName: 'Zahra',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  const existingFatima = await tutorRepository.findOne({ where: { userId: fatimaUser.id } });
  if (!existingFatima) {
    await tutorRepository.save(
      tutorRepository.create({
        userId: fatimaUser.id,
        bio: 'معلمة لغة عربية بخبرة واسعة في تدريس الطلاب من جميع المستويات.',
        specialization: 'Arabic',
        languages: ['Arabic', 'French'],
        hourlyRate: 45,
        balance: 0,
        totalHoursTaught: 100,
        status: CourseStatus.APPROVED,
      }),
    );
  }
  console.log('Tutor Fatimetou upserted (fatimetouzehra27@gmail.com).');

  // 9. SubAdmin (employee login for testing)
  const subAdminUser = await upsertUser({
    email: 'subadmin@mrhacademy.com',
    firstName: 'لمى',
    lastName: 'سعيد',
    role: UserRole.SUBADMIN,
    isVerified: true,
  });
  const existingSubAdmin = await subAdminRepository.findOne({ where: { userId: subAdminUser.id } });
  if (!existingSubAdmin) {
    await subAdminRepository.save(
      subAdminRepository.create({
        userId: subAdminUser.id,
        assignedPermissions: [
          'manage_tutors',
          'manage_payments',
          'view_reports',
          'impersonate_users',
        ],
      }),
    );
  } else {
    await subAdminRepository.update(existingSubAdmin.userId, {
      assignedPermissions: [
        'manage_tutors',
        'manage_payments',
        'view_reports',
        'impersonate_users',
      ],
    });
  }
  console.log('SubAdmin upserted (subadmin@mrhacademy.com).');

  // 10. Employees
  for (const emp of [
    {
      name: 'محمد الدوسري',
      email: 'mohammed@mrhacademy.com',
      roleTitle: 'مدقق حسابات',
      permissions: 'Accept/reject tutor requests, Edit courses',
    },
    {
      name: 'لمى سعيد',
      email: 'subadmin@mrhacademy.com',
      roleTitle: 'دعم فني',
      permissions: JSON.stringify([
        'manage_tutors',
        'manage_payments',
        'view_reports',
        'impersonate_users',
      ]),
    },
  ]) {
    const existing = await employeeRepository.findOne({ where: { email: emp.email } });
    if (existing) {
      await employeeRepository.update(existing.id, emp);
    } else {
      await employeeRepository.save(employeeRepository.create(emp));
    }
  }
  console.log('Employees upserted (محمد الدوسري, لمى سعيد).');

  // 11. Courses (only create if none exist for that tutor+title)
  const coursesToSeed = [
    {
      tutorId: yasmeenUser.id,
      title: 'العربية الفصحى لغير الناطقين بها',
      description:
        'دورة شاملة لتعليم اللغة العربية الفصحى للمبتدئين والمتقدمين.',
      price: 120,
      status: CourseStatus.APPROVED,
    },
    {
      tutorId: sarahUser.id,
      title: 'English Conversation Masterclass',
      description:
        'Master everyday English conversation with a native-level instructor.',
      price: 150,
      status: CourseStatus.APPROVED,
    },
    {
      tutorId: sarahUser.id,
      title: 'تجهيز اختبار الآيلتس (IELTS)',
      description: 'دورة مكثفة للتحضير لاختبار IELTS مع تمارين ونماذج حقيقية.',
      price: 200,
      status: CourseStatus.APPROVED,
    },
  ];
  for (const course of coursesToSeed) {
    const existing = await courseRepository.findOne({
      where: { tutorId: course.tutorId, title: course.title },
    });
    if (!existing) {
      await courseRepository.save(courseRepository.create(course));
    }
  }
  console.log('Courses upserted (3 courses).');

  // 12. Availability
  const tutors = [sarahUser, yasmeenUser, fatimaUser];
  for (const tutor of tutors) {
    const existingAvailability = await availabilityRepository.find({ where: { tutorId: tutor.id } });
    if (existingAvailability.length === 0) {
      // Add default availability: Sunday (0) to Thursday (4), 10:00 to 18:00
      for (let day = 0; day <= 4; day++) {
        await availabilityRepository.save(
          availabilityRepository.create({
            tutorId: tutor.id,
            dayOfWeek: day,
            startTime: '10:00',
            endTime: '18:00',
            isRecurring: true,
          }),
        );
      }
    }
  }
  console.log('Tutor availability upserted (Default: Sun-Thu, 10:00-18:00).');

  // 13. Settings
  const settingsToSeed = [
    { key: 'platform_name', value: 'Mr.H Academy' },
    { key: 'contact_email', value: 'hello@mrhacademy.com' },
    { key: 'default_lesson_price', value: '15' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'course_tutor_promo_rate', value: '0.02' },
    { key: 'course_academy_base_rate', value: '0.53' },
    { key: 'payment_vodafone_number', value: '01000000000' },
    { key: 'payment_instapay_handle', value: '@mrh_academy' },
    { key: 'payment_binance_id', value: 'Configure in admin settings' },
    { key: 'payment_bank_details', value: 'National Bank of Egypt - Account 123456789' },
  ];
  for (const s of settingsToSeed) {
    const existing = await settingRepository.findOne({ where: { key: s.key } });
    if (existing) {
      await settingRepository.update(existing.key, { value: s.value });
    } else {
      await settingRepository.save(settingRepository.create(s));
    }
  }
  console.log('System settings upserted.');

  console.log('\n========================================');
  console.log('  Seeding completed successfully!');
  console.log('========================================');
  console.log('');
  console.log('Demo Credentials (all use password: 123456):');
  console.log('  Admin:    admin@mrhacademy.com');
  console.log('  Owner:    fekrah23451@gmail.com');
  console.log('  Student:  student@demo.com');
  console.log('  Student:  hkprivat50@gmail.com');
  console.log('  Tutor:    Sarah.alazzeh87@gmail.com');
  console.log('  Tutor:    yasmenaiman1@gmail.com');
  console.log('  Tutor:    fatimetouzehra27@gmail.com');
  console.log('  SubAdmin: subadmin@mrhacademy.com');
  console.log('');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
