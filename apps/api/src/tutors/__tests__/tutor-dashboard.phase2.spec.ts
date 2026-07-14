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
      lessonRepository as ConstructorParameters<
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
});
