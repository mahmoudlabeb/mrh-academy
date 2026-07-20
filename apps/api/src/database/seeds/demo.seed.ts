import { argon2id, hash } from 'argon2';
import { CourseStatus, UserRole } from '@mrh/types';
import { AppDataSource } from '../data-source.js';
import { User } from '../../users/entities/user.entity.js';
import { StudentProfile } from '../../students/entities/student-profile.entity.js';
import { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';

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
        } else {
          await manager.save(
            TutorProfile,
            manager.create(TutorProfile, {
              userId: user.id,
              bio: 'Fictional tutor profile for local development.',
              specialization: 'Demo curriculum',
              languages: ['Arabic', 'English'],
              hourlyRate: 15,
              status: CourseStatus.APPROVED,
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
