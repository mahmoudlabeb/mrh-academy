import 'reflect-metadata';
import { argon2id, hash } from 'argon2';
import {
  CourseStatus,
  LessonStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '@mrh/types';
import { AppDataSource } from '../data-source.js';
import { User } from '../../users/entities/user.entity.js';
import { StudentProfile } from '../../students/entities/student-profile.entity.js';
import { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';
import { TutorAvailability } from '../../tutors/entities/tutor-availability.entity.js';
import { SubAdminProfile } from '../../admin/entities/sub-admin-profile.entity.js';
import { Employee } from '../../admin/entities/employee.entity.js';
import { Course } from '../../courses/entities/course.entity.js';
import { Lesson } from '../../lessons/entities/lesson.entity.js';
import { Payment } from '../../payments/entities/payment.entity.js';

const supportSubAdminPermissions = [
  'manage_tutors',
  'manage_students',
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

  const password =
    process.env.DEMO_SEED_PASSWORD || 'UMdpAglrVSLtvuqhqlCn3u3RVfsruipu';
  if (!password || password.length < 15) {
    throw new Error('DEMO_SEED_PASSWORD must contain at least 15 characters');
  }

  AppDataSource.setOptions({
    entities: [
      User,
      StudentProfile,
      TutorProfile,
      TutorAvailability,
      SubAdminProfile,
      Employee,
      Course,
      Lesson,
      Payment,
    ],
  });
  await AppDataSource.initialize();
  const passwordHash = await hash(password, { type: argon2id });

  try {
    for (const fixture of demoUsers) {
      await AppDataSource.transaction(async (manager) => {
        const existing = await manager.findOne(User, {
          where: { email: fixture.email },
        });
        const user = await manager.save(
          User,
          existing
            ? Object.assign(existing, {
                ...fixture,
                passwordHash,
                isVerified: true,
                isActive: true,
                deletedAt: null,
              })
            : manager.create(User, {
                ...fixture,
                passwordHash,
                isVerified: true,
              }),
        );

        if (fixture.role === UserRole.STUDENT) {
          const profile = await manager.findOne(StudentProfile, {
            where: { userId: user.id },
          });
          if (!profile) {
            await manager.save(
              StudentProfile,
              manager.create(StudentProfile, {
                userId: user.id,
                balance: 100,
              }),
            );
          }
        } else if (fixture.role === UserRole.TUTOR) {
          const profile = await manager.findOne(TutorProfile, {
            where: { userId: user.id },
          });
          if (!profile) {
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
          } else {
            profile.status = fixture.tutorStatus;
            await manager.save(profile);
          }
        } else if (fixture.role === UserRole.SUBADMIN) {
          const profile = await manager.findOne(SubAdminProfile, {
            where: { userId: user.id },
          });
          if (!profile) {
            await manager.save(
              SubAdminProfile,
              manager.create(SubAdminProfile, {
                userId: user.id,
                assignedPermissions: [...supportSubAdminPermissions],
              }),
            );
          } else {
            profile.assignedPermissions = [...supportSubAdminPermissions];
            await manager.save(profile);
          }
          const existingEmployee = await manager.findOne(Employee, {
            where: { email: fixture.email },
          });
          if (!existingEmployee) {
            await manager.save(
              Employee,
              manager.create(Employee, {
                name: `${fixture.firstName} ${fixture.lastName}`,
                email: fixture.email,
                roleTitle: 'Demo Operations Manager',
                permissions: JSON.stringify(supportSubAdminPermissions),
              }),
            );
          }
        }
      });
    }

    const demoTutor = await AppDataSource.getRepository(User).findOne({
      where: { email: 'tutor.one@mrh-academy.example' },
    });
    const demoStudent = await AppDataSource.getRepository(User).findOne({
      where: { email: 'student.one@mrh-academy.example' },
    });
    if (demoTutor) {
      await AppDataSource.transaction(async (manager) => {
        const availabilityCount = await manager.count(TutorAvailability, {
          where: { tutorId: demoTutor.id },
        });
        if (availabilityCount === 0) {
          const workingHours = [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 5, startTime: '10:00', endTime: '16:00' },
          ];
          await manager.save(
            TutorAvailability,
            workingHours.map(({ dayOfWeek, startTime, endTime }) =>
              manager.create(TutorAvailability, {
                tutorId: demoTutor.id,
                dayOfWeek,
                startTime,
                endTime,
                isRecurring: true,
              }),
            ),
          );
        }

        const demoCourseCount = await manager
          .getRepository(Course)
          .createQueryBuilder('course')
          .where('course.tutorId = :tutorId', { tutorId: demoTutor.id })
          .andWhere('course.title IN (:...titles)', {
            titles: [
              'Arabic Conversation Foundations',
              'Business English Essentials',
            ],
          })
          .getCount();
        if (demoCourseCount === 0) {
          await manager.save(Course, [
            manager.create(Course, {
              tutorId: demoTutor.id,
              title: 'Arabic Conversation Foundations',
              description:
                'A practical beginner course focused on everyday Arabic conversation.',
              price: 49,
              soldBy: 'academy',
              status: CourseStatus.APPROVED,
              videoQualityApprovedAt: new Date(),
            }),
            manager.create(Course, {
              tutorId: demoTutor.id,
              title: 'Business English Essentials',
              description:
                'Workplace terminology, meetings, presentations, and professional writing.',
              price: 65,
              soldBy: 'tutor',
              status: CourseStatus.PENDING,
            }),
          ]);
        }
      });
    }

    if (demoTutor && demoStudent) {
      await AppDataSource.transaction(async (manager) => {
        const completedLesson = await manager.findOne(Lesson, {
          where: {
            tutorId: demoTutor.id,
            studentId: demoStudent.id,
            status: LessonStatus.COMPLETED,
          },
        });
        if (!completedLesson) {
          const scheduledTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const endTime = new Date(scheduledTime.getTime() + 50 * 60 * 1000);
          await manager.save(
            Lesson,
            manager.create(Lesson, {
              tutorId: demoTutor.id,
              studentId: demoStudent.id,
              scheduledTime,
              endTime,
              durationMinutes: 50,
              price: 15,
              platformFee: 1.5,
              status: LessonStatus.COMPLETED,
              roomId: 'demo-completed-lesson',
              notes: 'Completed demo lesson for earnings history.',
            }),
          );
          await manager.decrement(
            StudentProfile,
            { userId: demoStudent.id },
            'balance',
            15,
          );
          await manager.increment(
            TutorProfile,
            { userId: demoTutor.id },
            'balance',
            13.5,
          );
        }

        const demoPayment = await manager.findOne(Payment, {
          where: {
            userId: demoStudent.id,
            adminNote: 'Demo wallet funding',
          },
        });
        if (!demoPayment) {
          await manager.save(
            Payment,
            manager.create(Payment, {
              userId: demoStudent.id,
              amount: 100,
              method: PaymentMethod.CARD,
              currency: 'USD',
              status: PaymentStatus.APPROVED,
              adminNote: 'Demo wallet funding',
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
