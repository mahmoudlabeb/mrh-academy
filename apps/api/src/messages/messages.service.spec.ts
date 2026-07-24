import { ForbiddenException } from '@nestjs/common';
import { CourseStatus, UserRole } from '@mrh/types';
import type { Repository } from 'typeorm';
import { MessagesService } from './messages.service';
import type { Message } from './entities/message.entity';
import type { Lesson } from '../lessons/entities/lesson.entity';
import type { User } from '../users/entities/user.entity';
import type { Notification } from './entities/notification.entity';

describe('MessagesService first-contact permissions', () => {
  const student = {
    id: 'student-id',
    role: UserRole.STUDENT,
    firstName: 'Demo',
    lastName: 'Student',
    isActive: true,
  } as User;
  const approvedTutor = {
    id: 'approved-tutor-id',
    role: UserRole.TUTOR,
    firstName: 'Demo',
    lastName: 'Tutor',
    isActive: true,
    tutorProfile: { status: CourseStatus.APPROVED },
  } as User;

  let messageRepository: jest.Mocked<Repository<Message>>;
  let lessonRepository: jest.Mocked<Repository<Lesson>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let service: MessagesService;

  beforeEach(() => {
    messageRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value as Message),
      save: jest.fn(async (value) => value as Message),
    } as unknown as jest.Mocked<Repository<Message>>;
    lessonRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Lesson>>;
    userRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(approvedTutor),
    } as unknown as jest.Mocked<Repository<User>>;
    notificationRepository = {
      create: jest.fn((value) => value as Notification),
      save: jest.fn(async (value) => value as Notification),
    } as unknown as jest.Mocked<Repository<Notification>>;

    service = new MessagesService(
      messageRepository,
      lessonRepository,
      userRepository,
      notificationRepository,
    );
  });

  it('allows a student to send the first message to the exact approved tutor', async () => {
    messageRepository.findOne.mockResolvedValue(null);
    lessonRepository.findOne.mockResolvedValue(null);

    await service.sendMessage(student.id, {
      receiverId: approvedTutor.id,
      content: 'Can you help me with English?',
    });

    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: student.id,
        receiverId: approvedTutor.id,
      }),
    );
    expect(messageRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a first message from a tutor to a student without a shared lesson', async () => {
    userRepository.findOne
      .mockReset()
      .mockResolvedValueOnce(approvedTutor)
      .mockResolvedValueOnce(student);
    messageRepository.findOne.mockResolvedValue(null);
    lessonRepository.findOne.mockResolvedValue(null);

    await expect(
      service.sendMessage(approvedTutor.id, {
        receiverId: student.id,
        content: 'Unsolicited message',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a first message to a tutor who is not approved', async () => {
    const pendingTutor = {
      ...approvedTutor,
      id: 'pending-tutor-id',
      tutorProfile: { status: CourseStatus.PENDING },
    } as User;
    userRepository.findOne
      .mockReset()
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(pendingTutor);
    messageRepository.findOne.mockResolvedValue(null);
    lessonRepository.findOne.mockResolvedValue(null);

    await expect(
      service.sendMessage(student.id, {
        receiverId: pendingTutor.id,
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('preserves messaging for an existing conversation', async () => {
    const admin = {
      id: 'admin-id',
      role: UserRole.ADMIN,
      firstName: 'Academy',
      lastName: 'Admin',
      isActive: true,
    } as User;
    userRepository.findOne
      .mockReset()
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce(student);
    messageRepository.findOne.mockResolvedValue({
      id: 'existing-message',
    } as Message);

    await service.sendMessage(admin.id, {
      receiverId: student.id,
      content: 'Conversation follow-up',
    });

    expect(lessonRepository.findOne).not.toHaveBeenCalled();
    expect(messageRepository.save).toHaveBeenCalledTimes(1);
  });
});
