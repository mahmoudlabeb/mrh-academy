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

  // 1. SYSTEM user
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
  console.log('SYSTEM user created.');

  // 2. Admin (المدير العام)
  const admin = userRepository.create({
    email: 'admin@mrhacademy.com',
    passwordHash: defaultPassword,
    firstName: 'المدير',
    lastName: 'العام',
    role: UserRole.ADMIN,
    isVerified: true,
  });
  await userRepository.save(admin);
  console.log('Admin created (admin@mrhacademy.com).');

  // 3. Owner (fekrah23451@gmail.com — مدير الموقع)
  const owner = userRepository.create({
    email: 'fekrah23451@gmail.com',
    passwordHash: defaultPassword,
    firstName: 'مدير',
    lastName: 'الموقع',
    role: UserRole.ADMIN,
    isVerified: true,
  });
  await userRepository.save(owner);
  console.log('Owner created (fekrah23451@gmail.com).');

  // 4. Demo Student (student@demo.com)
  const demoStudent = userRepository.create({
    email: 'student@demo.com',
    passwordHash: defaultPassword,
    firstName: 'Demo',
    lastName: 'Student',
    role: UserRole.STUDENT,
    isVerified: true,
    avatarUrl: 'https://randomuser.me/api/portraits/men/45.jpg',
  });
  await userRepository.save(demoStudent);
  const demoStudentProfile = studentRepository.create({
    userId: demoStudent.id,
    balance: 50,
    preferredLanguage: 'ar',
  });
  await studentRepository.save(demoStudentProfile);
  console.log('Demo Student created (student@demo.com, balance $50).');

  // 5. Student with $50 balance (موسيقا عميقة)
  const hkStudent = userRepository.create({
    email: 'hkprivat50@gmail.com',
    passwordHash: defaultPassword,
    firstName: 'موسيقا',
    lastName: 'عميقة',
    role: UserRole.STUDENT,
    isVerified: true,
  });
  await userRepository.save(hkStudent);
  const hkProfile = studentRepository.create({
    userId: hkStudent.id,
    balance: 50,
    preferredLanguage: 'ar',
  });
  await studentRepository.save(hkProfile);
  console.log('Student created (hkprivat50@gmail.com, balance $50).');

  // 6. Tutor Sarah (English)
  const sarahUser = userRepository.create({
    email: 'Sarah.alazzeh87@gmail.com',
    passwordHash: defaultPassword,
    firstName: 'Sarah',
    lastName: 'Alazzeh',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  await userRepository.save(sarahUser);
  const sarahProfile = tutorRepository.create({
    userId: sarahUser.id,
    bio: 'Experienced English tutor specializing in conversation and IELTS preparation.',
    specialization: 'English',
    languages: ['English', 'Arabic'],
    hourlyRate: 60,
    balance: 0,
    totalHoursTaught: 150,
    status: CourseStatus.APPROVED,
  });
  await tutorRepository.save(sarahProfile);
  console.log('Tutor Sarah created (Sarah.alazzeh87@gmail.com).');

  // 7. Tutor Yasmeen (Arabic)
  const yasmeenUser = userRepository.create({
    email: 'yasmenaiman1@gmail.com',
    passwordHash: defaultPassword,
    firstName: 'Yasmeen',
    lastName: 'Ayman',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  await userRepository.save(yasmeenUser);
  const yasmeenProfile = tutorRepository.create({
    userId: yasmeenUser.id,
    bio: 'متخصصة في تدريس العربية الفصحى لغير الناطقين بها.',
    specialization: 'Arabic',
    languages: ['Arabic', 'English'],
    hourlyRate: 50,
    balance: 0,
    totalHoursTaught: 200,
    status: CourseStatus.APPROVED,
  });
  await tutorRepository.save(yasmeenProfile);
  console.log('Tutor Yasmeen created (yasmenaiman1@gmail.com).');

  // 8. Tutor Fatimetou (Arabic)
  const fatimaUser = userRepository.create({
    email: 'fatimetouzehra27@gmail.com',
    passwordHash: defaultPassword,
    firstName: 'Fatimetou',
    lastName: 'Zahra',
    role: UserRole.TUTOR,
    isVerified: true,
  });
  await userRepository.save(fatimaUser);
  const fatimaProfile = tutorRepository.create({
    userId: fatimaUser.id,
    bio: 'معلمة لغة عربية بخبرة واسعة في تدريس الطلاب من جميع المستويات.',
    specialization: 'Arabic',
    languages: ['Arabic', 'French'],
    hourlyRate: 45,
    balance: 0,
    totalHoursTaught: 100,
    status: CourseStatus.APPROVED,
  });
  await tutorRepository.save(fatimaProfile);
  console.log('Tutor Fatimetou created (fatimetouzehra27@gmail.com).');

  // 9. SubAdmin profile (for future use — linked later)
  console.log('SubAdmin profile skipped (no specific account requested).');

  // 10. Employees
  await employeeRepository.save([
    employeeRepository.create({
      name: 'محمد الدوسري',
      email: 'mohammed@mrhacademy.com',
      roleTitle: 'مدقق حسابات',
      permissions: 'Accept/reject tutor requests, Edit courses',
    }),
    employeeRepository.create({
      name: 'لمى سعيد',
      email: 'lama@mrhacademy.com',
      roleTitle: 'دعم فني',
      permissions: 'Access classroom reports, Message users',
    }),
  ]);
  console.log('Employees created (محمد الدوسري, لمى سعيد).');

  // 11. Courses
  await courseRepository.save([
    courseRepository.create({
      tutorId: yasmeenUser.id,
      title: 'العربية الفصحى لغير الناطقين بها',
      description:
        'دورة شاملة لتعليم اللغة العربية الفصحى للمبتدئين والمتقدمين.',
      price: 120,
      status: CourseStatus.APPROVED,
    }),
    courseRepository.create({
      tutorId: sarahUser.id,
      title: 'English Conversation Masterclass',
      description:
        'Master everyday English conversation with a native-level instructor.',
      price: 150,
      status: CourseStatus.APPROVED,
    }),
    courseRepository.create({
      tutorId: sarahUser.id,
      title: 'تجهيز اختبار الآيلتس (IELTS)',
      description: 'دورة مكثفة للتحضير لاختبار IELTS مع تمارين ونماذج حقيقية.',
      price: 200,
      status: CourseStatus.APPROVED,
    }),
  ]);
  console.log('3 Courses created.');

  // 12. Settings
  await settingRepository.save([
    settingRepository.create({ key: 'platform_name', value: 'Mr.H Academy' }),
    settingRepository.create({
      key: 'contact_email',
      value: 'hello@mrhacademy.com',
    }),
    settingRepository.create({ key: 'default_lesson_price', value: '15' }),
    settingRepository.create({ key: 'maintenance_mode', value: 'false' }),
    settingRepository.create({ key: 'course_tutor_promo_rate', value: '0.02' }),
    settingRepository.create({
      key: 'course_academy_base_rate',
      value: '0.53',
    }),
  ]);
  console.log('System settings created.');

  console.log('Seeding completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
