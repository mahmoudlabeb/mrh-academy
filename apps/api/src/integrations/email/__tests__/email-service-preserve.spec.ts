import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';

// Mock nodemailer so no real DNS lookups or network connections are made.
// sendMail rejects to simulate a broken SMTP server — this lets us verify
// that EmailService swallows the error instead of re-throwing it to the caller.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    verify: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  })),
}));

describe('B2 Preservation — Email Non-Re-throw and App Startup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sendEmail() should never reject to the caller even when the transporter fails', async () => {
    // SMTP is configured but sendMail() rejects — EmailService must swallow it
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.invalid',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);

    // Must resolve (not reject) — email failure must never break the caller
    await expect(
      emailService.sendEmail('test@test.com', 'Subject', '<p>Body</p>'),
    ).resolves.toBeUndefined();
  });

  it('should bootstrap successfully without any SMTP env vars set', async () => {
    // No SMTP config at all — app must still start cleanly
    const configService = new ConfigService({});

    await expect(
      Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile(),
    ).resolves.toBeDefined();
  });

  it('sendPlainEmail() should never reject to the caller even when the transporter fails', async () => {
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.invalid',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);

    await expect(
      emailService.sendPlainEmail('test@test.com', 'Subject', 'Text body'),
    ).resolves.toBeUndefined();
  });
});
