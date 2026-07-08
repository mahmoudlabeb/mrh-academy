import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MessagesService } from './messages.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getNotifications(
    @CurrentUser() user: { id: string },
    @Query('unread') unread?: string,
  ) {
    const isUnread = unread === 'true';
    return this.messagesService.getNotifications(user.id, unread ? isUnread : undefined);
  }
}
