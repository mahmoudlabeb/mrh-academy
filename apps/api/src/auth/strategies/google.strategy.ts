import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly googleEnabled: boolean;

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    const enabled = !!(clientID && clientSecret && callbackURL);

    super({
      clientID: clientID ?? 'missing',
      clientSecret: clientSecret ?? 'missing',
      callbackURL: callbackURL ?? 'http://localhost/missing',
      scope: ['profile', 'email'],
      state: true,
    });

    this.googleEnabled = enabled;
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails: Array<{ value: string }>;
      name: { givenName: string; familyName: string };
      photos: Array<{ value: string }>;
    },
    _done: VerifyCallback,
  ) {
    if (!this.googleEnabled) {
      throw new UnauthorizedException(
        'Google authentication is not configured',
      );
    }
    const { id, emails, name, photos } = profile;
    const email = emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google account has no email address');
    }
    return {
      googleId: id,
      email,
      firstName: name?.givenName ?? 'User',
      lastName: name?.familyName ?? '',
      avatarUrl: photos?.[0]?.value,
    };
  }
}
