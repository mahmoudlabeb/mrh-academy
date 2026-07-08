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
  ) {
    const isUnread = unread === 'true';
    return this.messagesService.getNotifications(
      user.id,
      unread ? isUnread : undefined,
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
