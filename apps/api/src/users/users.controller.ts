import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UploadRateGuard } from '../common/guards/upload-rate.guard.js';
import { UseGuards } from '@nestjs/common';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateNotificationPreferencesDto,
  UpdateProfileDto,
} from './dto/index.js';
import { UsersService } from './users.service.js';
import { TokenDto } from '../auth/dto/token.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

type AuthenticatedUser = { id: string; role: string };
type AvatarFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('confirm-email')
  confirmEmailChange(@Body() dto: TokenDto) {
    return this.usersService.confirmEmailChange(dto.token);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Patch('change-email')
  changeEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeEmailDto,
  ) {
    return this.usersService.changeEmail(user.id, dto);
  }

  @Post('avatar')
  @UseGuards(UploadRateGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, and WebP files are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: AvatarFile | undefined,
  ) {
    return this.usersService.updateAvatar(user.id, file);
  }

  @Post('switch-role')
  async switchRole(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.switchRole(user.id);
  }

  @Get('me/notification-preferences')
  getNotificationPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getNotificationPreferences(user.id);
  }

  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.id, dto);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteMe(user.id);
  }
}
