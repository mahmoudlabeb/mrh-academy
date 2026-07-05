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
import {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/index.js';
import { UsersService } from './users.service.js';

type AuthenticatedUser = { id: string };
type AvatarFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @UseInterceptors(
    FileInterceptor('avatar', {
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          callback(
            new BadRequestException('Only JPEG and PNG files are allowed'),
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

  @Delete('me')
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteMe(user.id);
  }
}
