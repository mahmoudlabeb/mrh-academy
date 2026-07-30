import { ClassroomAccessState } from '@mrh/types';
import type { Socket } from 'socket.io';
import { ClassroomGateway } from './classroom.gateway';

describe('ClassroomGateway access enforcement', () => {
  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const classroomRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const accessService = {
    findByLessonId: jest.fn(),
  };

  const createSocket = () => {
    const roomEmitter = { emit: jest.fn() };
    return {
      data: {
        userId: 'student-1',
        role: 'student',
        currentLesson: null,
      },
      emit: jest.fn(),
      join: jest.fn(),
      to: jest.fn(() => roomEmitter),
      roomEmitter,
    };
  };

  const createGateway = () => {
    const gateway = new ClassroomGateway(
      {} as never,
      {} as never,
      redisService as never,
      classroomRepository as never,
      {} as never,
      accessService as never,
    );
    gateway.server = {
      sockets: { sockets: new Map() },
    } as never;
    return gateway;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisService.get.mockResolvedValue(null);
    redisService.set.mockResolvedValue(undefined);
    classroomRepository.findOne.mockResolvedValue(null);
  });

  it('does not join the socket room when the server access decision denies entry', async () => {
    accessService.findByLessonId.mockResolvedValue({
      lesson: { id: 'lesson-1' },
      access: {
        state: ClassroomAccessState.WAITING,
        canJoin: false,
        reason: 'This classroom is not open yet',
        opensAt: '2030-01-01T09:45:00.000Z',
        closesAt: '2030-01-01T11:05:00.000Z',
        serverTime: '2030-01-01T09:30:00.000Z',
      },
    });
    const socket = createSocket();

    await createGateway().handleJoinLesson(socket as unknown as Socket, {
      lessonId: 'lesson-1',
    });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'classroom_access_denied',
      expect.objectContaining({
        state: ClassroomAccessState.WAITING,
        canJoin: false,
      }),
    );
  });

  it('joins and initializes the room only after an allowed decision', async () => {
    accessService.findByLessonId.mockResolvedValue({
      lesson: { id: 'lesson-1' },
      access: {
        state: ClassroomAccessState.ALLOWED,
        canJoin: true,
        reason: 'Classroom access granted',
        opensAt: '2030-01-01T09:45:00.000Z',
        closesAt: '2030-01-01T11:05:00.000Z',
        serverTime: '2030-01-01T10:00:00.000Z',
      },
    });
    const socket = createSocket();

    await createGateway().handleJoinLesson(socket as unknown as Socket, {
      lessonId: 'lesson-1',
    });

    expect(socket.join).toHaveBeenCalledWith('lesson-1');
    expect(socket.data.currentLesson).toBe('lesson-1');
    expect(socket.emit).toHaveBeenCalledWith(
      'whiteboard_sync',
      expect.objectContaining({ currentPage: 1 }),
    );
  });
});
