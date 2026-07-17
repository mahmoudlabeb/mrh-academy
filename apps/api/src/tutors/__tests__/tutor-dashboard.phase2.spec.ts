import { TutorDashboardController } from '../tutor-dashboard.controller.js';

describe('TutorDashboardController phase 2 regression', () => {
  it('returns student avatarUrl without reading a non-existent avatar field', async () => {
    const lessonRepository = {
      find: jest.fn().mockResolvedValue([
        {
          studentId: 'student-1',
          student: {
            id: 'student-1',
            firstName: 'Sara',
            lastName: 'Ali',
            email: 'sara@example.com',
            avatarUrl: 'https://cdn.example.com/sara.png',
          },
        },
      ]),
    };
    const controller = new TutorDashboardController(
      lessonRepository as unknown as ConstructorParameters<
        typeof TutorDashboardController
      >[0],
    );

    await expect(controller.getStudents({ id: 'tutor-1' })).resolves.toEqual([
      {
        id: 'student-1',
        firstName: 'Sara',
        lastName: 'Ali',
        email: 'sara@example.com',
        avatarUrl: 'https://cdn.example.com/sara.png',
        lessonCount: 1,
      },
    ]);
  });

  it('returns avatarUrl: null when student has no avatar set (P2-B preservation)', async () => {
    const lessonRepository = {
      find: jest.fn().mockResolvedValue([
        {
          studentId: 'student-2',
          student: {
            id: 'student-2',
            firstName: 'Noor',
            lastName: 'Khaled',
            email: 'noor@example.com',
            avatarUrl: null,
          },
        },
      ]),
    };
    const controller = new TutorDashboardController(
      lessonRepository as unknown as ConstructorParameters<
        typeof TutorDashboardController
      >[0],
    );

    await expect(controller.getStudents({ id: 'tutor-1' })).resolves.toEqual([
      {
        id: 'student-2',
        firstName: 'Noor',
        lastName: 'Khaled',
        email: 'noor@example.com',
        avatarUrl: null,
        lessonCount: 1,
      },
    ]);
  });
});
