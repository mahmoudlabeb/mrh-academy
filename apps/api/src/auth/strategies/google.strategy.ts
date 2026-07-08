import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  VerifyCallback,
  StrategyOptions,
} from 'passport-google-oauth20';
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
    });

    this.googleEnabled = enabled;
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    _done: VerifyCallback,
  ) {
    if (!this.googleEnabled) {
      throw new UnauthorizedException(
        'Google authentication is not configured',
      );
    }
    const { id, emails, name, photos } = profile;
    return {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      avatarUrl: photos[0]?.value,
    };
  }
}
