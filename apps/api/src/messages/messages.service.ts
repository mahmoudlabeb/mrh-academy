import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { LessonStatus } from '@mrh/types';
import { Message } from '../entities/message.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { User } from '../entities/user.entity.js';
import { Notification } from '../entities/notification.entity.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async getContacts(userId: string) {
    const messageContacts = await this.messageRepository
      .createQueryBuilder('m')
      .select(
        `CASE WHEN m.senderId = :userId THEN m.receiverId ELSE m.senderId END`,
        'contactId',
      )
      .where('m.senderId = :userId OR m.receiverId = :userId', { userId })
      .distinct(true)
      .getRawMany<{ contactId: string }>();

    const lessonContacts = await this.lessonRepository
      .createQueryBuilder('l')
      .select(
        `CASE WHEN l.tutorId = :userId THEN l.studentId ELSE l.tutorId END`,
        'contactId',
      )
      .where(
        '(l.tutorId = :userId OR l.studentId = :userId) AND l.status IN (:...statuses)',
        { userId, statuses: [LessonStatus.CONFIRMED, LessonStatus.COMPLETED] },
      )
      .distinct(true)
      .getRawMany<{ contactId: string }>();

    const contactIds = [
      ...new Set([
        ...messageContacts.map((r) => r.contactId),
        ...lessonContacts.map((r) => r.contactId),
      ]),
    ];

    if (contactIds.length === 0) {
      return [];
    }

    const users = await this.userRepository.find({
      where: { id: In(contactIds) },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    const contacts = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await this.messageRepository
          .createQueryBuilder('m')
          .where(
            '(m.senderId = :userId AND m.receiverId = :contactId) OR (m.senderId = :contactId AND m.receiverId = :userId)',
            { userId, contactId: user.id },
          )
          .orderBy('m.createdAt', 'DESC')
          .getOne();

        const unreadCount = await this.messageRepository.count({
          where: {
            senderId: user.id,
            receiverId: userId,
            isRead: false,
          },
        });

        return {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                isRead: lastMessage.isRead,
                senderId: lastMessage.senderId,
              }
            : null,
          unreadCount,
        };
      }),
    );

    contacts.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return (
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
      );
    });

    return contacts;
  }

  async getUnreadCount(userId: string) {
    const count = await this.messageRepository.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
    return { count };
  }

  async getNotifications(userId: string, unread?: boolean) {
    const where: { userId: string; isRead?: boolean } = { userId };
    if (unread === true) {
      where.isRead = false;
    } else if (unread === false) {
      where.isRead = true;
    }
    return this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllNotificationsRead(userId: string) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }

  async getConversation(
    userId: string,
    contactId: string,
    offset = 0,
    limit = 50,
  ) {
    const [messages, total] = await this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.receiver', 'receiver')
      .where(
        '(m.senderId = :userId AND m.receiverId = :contactId) OR (m.senderId = :contactId AND m.receiverId = :userId)',
        { userId, contactId },
      )
      .orderBy('m.createdAt', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    await this.messageRepository.update(
      {
        senderId: contactId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true },
    );

    return { messages, total };
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const receiver = await this.userRepository.findOne({
      where: { id: dto.receiverId },
    });
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    const sanitizedContent = this.sanitizeHtml(dto.content);

    const message = this.messageRepository.create({
      senderId,
      receiverId: dto.receiverId,
      content: sanitizedContent,
    });
    await this.messageRepository.save(message);

    const sender = await this.userRepository.findOne({
      where: { id: senderId },
    });

    const notification = this.notificationRepository.create({
      userId: dto.receiverId,
      type: 'new_message',
      title: 'New message',
      body: `You have a new message from ${sender ? `${sender.firstName} ${sender.lastName}` : 'a user'}`,
    });
    await this.notificationRepository.save(notification);

    return message;
  }

  private sanitizeHtml(input: string): string {
    return sanitizeHtml(input, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      allowedAttributes: {
        a: ['href'],
      },
    });
  }
}
