import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('contacts')
  @UseGuards(JwtAuthGuard)
  getContacts(@CurrentUser() user: { id: string }) {
    return this.messagesService.getContacts(user.id);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadCount(@CurrentUser() user: { id: string }) {
    return this.messagesService.getUnreadCount(user.id);
  }


  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  getConversation(
    @CurrentUser() user: { id: string },
    @Param('userId') contactId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getConversation(
      user.id,
      contactId,
      offset ? parseInt(offset, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @CurrentUser() user: { id: string },
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(user.id, dto);
  }
}
