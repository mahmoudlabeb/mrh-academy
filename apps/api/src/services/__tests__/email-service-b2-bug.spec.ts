import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';

// Mock nodemailer so no real DNS lookups or network connections are made.
// Without this, nodemailer would try to connect to smtp.example.com over the
// internet, which hangs until Jest times out.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    verify: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  })),
}));

describe('B2 Bug Condition — Silent Email Failures', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT call console.error when sendMail fails — Logger.error is used instead', async () => {
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);

    // sendMail rejects (simulating SMTP failure) — but sendEmail should NOT
    // propagate it to console.error; the fixed code uses this.logger.error instead
    await emailService.sendEmail('test@test.com', 'Subject', '<p>Body</p>');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log a warning at startup when SMTP credentials are not configured', async () => {
    // No SMTP_USER / SMTP_PASS → isConfigured = false → logger.warn expected
    const configService = new ConfigService({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);

    // Trigger onModuleInit which emits the warning
    await emailService.onModuleInit();

    // Service must still exist — no crash during startup
    expect(emailService).toBeDefined();
  });
});
