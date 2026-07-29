import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isUnread = unread === 'true';
    return this.messagesService.getNotifications(
      user.id,
      unread ? isUnread : undefined,
      Math.max(1, Math.floor(Number(page) || 1)),
      Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))),
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.messagesService.markNotificationRead(user.id, id);
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard)
  markAllAsRead(@CurrentUser() user: { id: string }) {
    return this.messagesService.markAllNotificationsRead(user.id);
  }
}
