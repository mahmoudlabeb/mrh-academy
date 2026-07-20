import { argon2id, hash } from 'argon2';
import { CourseStatus, UserRole } from '@mrh/types';
import { AppDataSource } from '../data-source.js';
import { User } from '../../users/entities/user.entity.js';
import { StudentProfile } from '../../students/entities/student-profile.entity.js';
import { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';
import { SubAdminProfile } from '../../admin/entities/sub-admin-profile.entity.js';
import { Employee } from '../../admin/entities/employee.entity.js';

const allSubAdminPermissions = [
  'manage_tutors',
  'manage_students',
  'manage_courses',
  'manage_lessons',
  'manage_payments',
  'manage_reviews',
  'manage_employees',
  'manage_settings',
  'view_reports',
  'impersonate_users',
] as const;

const demoUsers = [
  {
    email: 'student.one@mrh-academy.example',
    firstName: 'Demo',
    lastName: 'Student',
    role: UserRole.STUDENT,
  },
  {
    email: 'tutor.one@mrh-academy.example',
    firstName: 'Demo',
    lastName: 'Tutor',
    role: UserRole.TUTOR,
    tutorStatus: CourseStatus.APPROVED,
  },
  {
    email: 'tutor.pending@mrh-academy.example',
    firstName: 'Pending',
    lastName: 'Tutor',
    role: UserRole.TUTOR,
    tutorStatus: CourseStatus.PENDING,
  },
  {
    email: 'admin.one@mrh-academy.example',
    firstName: 'Demo',
    lastName: 'Admin',
    role: UserRole.ADMIN,
  },
  {
    email: 'subadmin.one@mrh-academy.example',
    firstName: 'Demo',
    lastName: 'SubAdmin',
    role: UserRole.SUBADMIN,
  },
] as const;

async function seedDemoData() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed:demo is disabled in production');
  }

  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 15) {
    throw new Error('DEMO_SEED_PASSWORD must contain at least 15 characters');
  }

  await AppDataSource.initialize();
  const passwordHash = await hash(password, { type: argon2id });

  try {
    for (const fixture of demoUsers) {
      await AppDataSource.transaction(async (manager) => {
        const existing = await manager.findOne(User, {
          where: { email: fixture.email },
        });
        if (existing) return;

        const user = await manager.save(
          User,
          manager.create(User, {
            ...fixture,
            passwordHash,
            isVerified: true,
          }),
        );

        if (fixture.role === UserRole.STUDENT) {
          await manager.save(
            StudentProfile,
            manager.create(StudentProfile, { userId: user.id }),
          );
        } else if (fixture.role === UserRole.TUTOR) {
          await manager.save(
            TutorProfile,
            manager.create(TutorProfile, {
              userId: user.id,
              bio: 'Fictional tutor profile for local development.',
              specialization: 'Demo curriculum',
              languages: ['Arabic', 'English'],
              hourlyRate: 15,
              status: fixture.tutorStatus,
            }),
          );
        } else if (fixture.role === UserRole.SUBADMIN) {
          await manager.save(
            SubAdminProfile,
            manager.create(SubAdminProfile, {
              userId: user.id,
              assignedPermissions: [...allSubAdminPermissions],
            }),
          );
          await manager.save(
            Employee,
            manager.create(Employee, {
              name: `${fixture.firstName} ${fixture.lastName}`,
              email: fixture.email,
              roleTitle: 'Demo Operations Manager',
              permissions: JSON.stringify(allSubAdminPermissions),
            }),
          );
        }
      });
    }
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Demo fixtures are ready.');
}

seedDemoData().catch((error: unknown) => {
  console.error(
    'Demo seed failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
