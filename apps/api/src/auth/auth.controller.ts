import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseFilters,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { GoogleConfigGuard } from './guards/google-config.guard.js';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { GoogleAuthExceptionFilter } from './filters/google-auth-exception.filter.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { TokenDto } from './dto/token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken?: string },
  ) {
    const secure =
      this.configService.get<string>('COOKIE_SECURE') === 'true' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    const base = {
      httpOnly: true,
      secure,
      sameSite: 'strict' as const,
      path: '/',
    };
    response.cookie('mrh_token', tokens.accessToken, {
      ...base,
      maxAge: 15 * 60 * 1000,
    });
    if (tokens.refreshToken) {
      response.cookie('mrh_refresh', tokens.refreshToken, {
        ...base,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie('mrh_token', { path: '/' });
    response.clearCookie('mrh_refresh', { path: '/' });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.clearAuthCookies(response);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result);
    return { user: result.user };
  }

  @Public()
  @Get('csrf')
  csrf() {
    return { status: 'ok' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.mrh_refresh as string | undefined;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(response, result);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.id);
    this.clearAuthCookies(response);
    return { message: 'Logged out successfully' };
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: { id: string }) {
    await this.authService.deleteAccount(user.id);
    return { message: 'Account deleted successfully' };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('resend-verification')
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleConfigGuard, GoogleOAuthGuard)
  @UseFilters(GoogleAuthExceptionFilter)
  async googleAuth() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleConfigGuard, GoogleOAuthGuard)
  @UseFilters(GoogleAuthExceptionFilter)
  async googleCallback(@CurrentUser() profile: any, @Res() res: Response) {
    const result = await this.authService.handleGoogleLogin(profile);
    this.setAuthCookies(res, result);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
