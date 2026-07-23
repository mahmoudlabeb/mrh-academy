import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { google } from 'googleapis';

type OAuthRequest = Request & { oauthNonce?: string };

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly googleEnabled: boolean;
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    const enabled = !!(clientID && clientSecret && callbackURL);

    super({
      clientID: clientID || 'missing',
      clientSecret: clientSecret || 'missing',
      callbackURL: callbackURL || 'http://localhost/missing',
      scope: ['openid', 'profile', 'email'],
      state: false,
      passReqToCallback: true,
    });

    this.googleEnabled = enabled;
    this.clientId = clientID || 'missing';
  }

  authorizationParams(options: { nonce?: string } = {}) {
    return options.nonce ? { nonce: options.nonce } : {};
  }

  async validate(
    request: OAuthRequest,
    _accessToken: string,
    _refreshToken: string,
    params: { id_token?: string },
    profile: {
      id: string;
      emails: Array<{ value: string }>;
      name: { givenName: string; familyName: string };
      photos: Array<{ value: string }>;
    },
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
    if (!params.id_token || !request.oauthNonce) {
      throw new UnauthorizedException('Google identity proof is missing');
    }
    const ticket = await new google.auth.OAuth2().verifyIdToken({
      idToken: params.id_token,
      audience: this.clientId,
    });
    const identity = ticket.getPayload();
    if (
      !identity ||
      identity.sub !== id ||
      identity.nonce !== request.oauthNonce ||
      identity.email_verified !== true
    ) {
      throw new UnauthorizedException('Google identity verification failed');
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
