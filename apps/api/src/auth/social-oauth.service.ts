import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type JsonWebKey,
} from 'node:crypto';
import { RedisService } from '../redis/redis.service.js';

type SocialProfile = {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

type AppleTokenClaims = {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | 'true';
  nonce?: string;
};

@Injectable()
export class SocialOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async createFacebookAuthorizationUrl() {
    const clientId = this.required('FACEBOOK_APP_ID');
    const callbackUrl = this.required('FACEBOOK_CALLBACK_URL');
    const state = await this.createState('facebook');
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'email,public_profile',
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${query}`;
  }

  async exchangeFacebookCode(
    code: string,
    state: string,
  ): Promise<SocialProfile> {
    await this.consumeState('facebook', state);
    const callbackUrl = this.required('FACEBOOK_CALLBACK_URL');
    const query = new URLSearchParams({
      client_id: this.required('FACEBOOK_APP_ID'),
      client_secret: this.required('FACEBOOK_APP_SECRET'),
      redirect_uri: callbackUrl,
      code,
    });
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${query}`,
    );
    if (!tokenResponse.ok) {
      throw new BadGatewayException('Facebook token exchange failed');
    }
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) {
      throw new UnauthorizedException('Facebook access token is missing');
    }
    const profileQuery = new URLSearchParams({
      fields: 'id,email,first_name,last_name,picture.type(large)',
      access_token: token.access_token,
    });
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?${profileQuery}`,
    );
    if (!profileResponse.ok) {
      throw new BadGatewayException('Facebook profile request failed');
    }
    const profile = (await profileResponse.json()) as {
      id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.id || !profile.email) {
      throw new UnauthorizedException(
        'Facebook account must provide a verified email address',
      );
    }
    return {
      providerId: profile.id,
      email: profile.email,
      firstName: profile.first_name || 'User',
      lastName: profile.last_name || '',
      avatarUrl: profile.picture?.data?.url,
    };
  }

  async createAppleAuthorizationUrl() {
    const clientId = this.required('APPLE_CLIENT_ID');
    const callbackUrl = this.required('APPLE_CALLBACK_URL');
    const nonce = randomBytes(24).toString('base64url');
    const state = await this.createState('apple', nonce);
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state,
      nonce,
    });
    return `https://appleid.apple.com/auth/authorize?${query}`;
  }

  async exchangeAppleCode(input: {
    code: string;
    state: string;
    idToken?: string;
    user?: string;
  }): Promise<SocialProfile> {
    const nonce = await this.consumeState('apple', input.state);
    const clientId = this.required('APPLE_CLIENT_ID');
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: this.required('APPLE_CALLBACK_URL'),
        client_id: clientId,
        client_secret: this.createAppleClientSecret(clientId),
      }),
    });
    if (!tokenResponse.ok) {
      throw new BadGatewayException('Apple token exchange failed');
    }
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    const claims = await this.verifyAppleIdentityToken(
      tokens.id_token || input.idToken || '',
      clientId,
      nonce,
    );
    if (!claims.sub || !claims.email) {
      throw new UnauthorizedException(
        'Apple identity is missing required data',
      );
    }
    let suppliedName: { name?: { firstName?: string; lastName?: string } } = {};
    if (input.user) {
      try {
        suppliedName = JSON.parse(input.user) as typeof suppliedName;
      } catch {
        suppliedName = {};
      }
    }
    return {
      providerId: claims.sub,
      email: claims.email,
      firstName: suppliedName.name?.firstName || 'Apple',
      lastName: suppliedName.name?.lastName || 'User',
    };
  }

  isFacebookConfigured() {
    return this.hasAll(
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_CALLBACK_URL',
    );
  }

  isAppleConfigured() {
    return this.hasAll(
      'APPLE_CLIENT_ID',
      'APPLE_TEAM_ID',
      'APPLE_KEY_ID',
      'APPLE_PRIVATE_KEY',
      'APPLE_CALLBACK_URL',
    );
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `${name} is required to enable this login provider`,
      );
    }
    return value;
  }

  private hasAll(...names: string[]) {
    return names.every((name) =>
      Boolean(this.config.get<string>(name)?.trim()),
    );
  }

  private async createState(provider: string, value = 'valid') {
    const state = randomBytes(32).toString('base64url');
    await this.redis.set(`oauth:${provider}:${state}`, value, 'EX', 10 * 60);
    return state;
  }

  private async consumeState(provider: string, state: string) {
    if (!state) throw new UnauthorizedException('OAuth state is missing');
    const value = await this.redis.getDel(`oauth:${provider}:${state}`);
    if (!value) throw new UnauthorizedException('OAuth state is invalid');
    return value;
  }

  private createAppleClientSecret(clientId: string) {
    const teamId = this.required('APPLE_TEAM_ID');
    const keyId = this.required('APPLE_KEY_ID');
    const privateKey = this.required('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = this.encodeJson({ alg: 'ES256', kid: keyId, typ: 'JWT' });
    const payload = this.encodeJson({
      iss: teamId,
      iat: now,
      exp: now + 5 * 60,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    });
    const signingInput = `${header}.${payload}`;
    const signature = sign('sha256', Buffer.from(signingInput), {
      key: createPrivateKey(privateKey),
      dsaEncoding: 'ieee-p1363',
    });
    return `${signingInput}.${signature.toString('base64url')}`;
  }

  private async verifyAppleIdentityToken(
    token: string,
    audience: string,
    nonce: string,
  ) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Apple identity token is invalid');
    }
    const header = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf8'),
    ) as { alg?: string; kid?: string };
    if (header.alg !== 'ES256' || !header.kid) {
      throw new UnauthorizedException('Apple identity algorithm is invalid');
    }
    const keysResponse = await fetch('https://appleid.apple.com/auth/keys');
    if (!keysResponse.ok) {
      throw new BadGatewayException('Apple signing keys are unavailable');
    }
    const keys = (await keysResponse.json()) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
    const jwk = keys.keys?.find((key) => key.kid === header.kid);
    if (!jwk) throw new UnauthorizedException('Apple signing key not found');
    const verified = verify(
      'sha256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      {
        key: createPublicKey({ key: jwk, format: 'jwk' }),
        dsaEncoding: 'ieee-p1363',
      },
      Buffer.from(parts[2], 'base64url'),
    );
    if (!verified) {
      throw new UnauthorizedException('Apple identity signature is invalid');
    }
    const claims = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as AppleTokenClaims;
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.iss !== 'https://appleid.apple.com' ||
      claims.aud !== audience ||
      !claims.exp ||
      claims.exp <= now ||
      claims.nonce !== nonce ||
      ![true, 'true'].includes(claims.email_verified ?? false)
    ) {
      throw new UnauthorizedException('Apple identity claims are invalid');
    }
    return claims;
  }

  private encodeJson(value: object) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
