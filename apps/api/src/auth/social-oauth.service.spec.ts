import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SocialOAuthService } from './social-oauth.service.js';

describe('SocialOAuthService', () => {
  const values: Record<string, string> = {
    FACEBOOK_APP_ID: 'facebook-app',
    FACEBOOK_APP_SECRET: 'facebook-secret',
    FACEBOOK_CALLBACK_URL:
      'https://api.example.test/api/v1/auth/facebook/callback',
    APPLE_CLIENT_ID: 'com.example.web',
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY123',
    APPLE_PRIVATE_KEY: 'unused-in-authorization-url',
    APPLE_CALLBACK_URL: 'https://api.example.test/api/v1/auth/apple/callback',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const redis = {
    set: jest.fn(async () => undefined),
    getDel: jest.fn(async () => 'valid'),
  };
  const service = new SocialOAuthService(config, redis as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a state-protected Facebook authorization URL', async () => {
    const url = new URL(await service.createFacebookAuthorizationUrl());

    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('facebook-app');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth:facebook:/),
      'valid',
      'EX',
      600,
    );
  });

  it('creates an Apple authorization URL with state and nonce', async () => {
    const url = new URL(await service.createAppleAuthorizationUrl());

    expect(url.origin).toBe('https://appleid.apple.com');
    expect(url.searchParams.get('client_id')).toBe('com.example.web');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth:apple:/),
      expect.any(String),
      'EX',
      600,
    );
  });

  it('refuses to start an unconfigured provider flow', async () => {
    const emptyConfig = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    const unconfigured = new SocialOAuthService(emptyConfig, redis as never);

    await expect(
      unconfigured.createFacebookAuthorizationUrl(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
