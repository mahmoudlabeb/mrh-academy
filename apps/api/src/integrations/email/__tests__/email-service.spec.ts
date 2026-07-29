import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../email.service';

const mockSendMail = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  })),
}));

describe('EmailService delivery failures', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendMail.mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await jest.runOnlyPendingTimersAsync();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function createService(config: Record<string, string>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: new ConfigService(config) },
      ],
    }).compile();

    return { module, service: module.get(EmailService) };
  }

  it.each([
    ['HTML', 'sendEmail'] as const,
    ['plain-text', 'sendPlainEmail'] as const,
  ])('contains %s delivery errors inside the queue', async (_label, method) => {
    const { module, service } = await createService({
      SMTP_HOST: 'smtp.invalid',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });

    await expect(
      service[method]('recipient@mrh-academy.example', 'Subject', 'Body'),
    ).resolves.toBeUndefined();
    await jest.runAllTimersAsync();

    expect(mockSendMail).toHaveBeenCalledTimes(4);
    expect(Logger.prototype.error).toHaveBeenCalled();
    await module.close();
  });

  it('starts without SMTP credentials and skips delivery', async () => {
    const { module, service } = await createService({});

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(
      service.sendEmail(
        'recipient@mrh-academy.example',
        'Subject',
        '<p>Body</p>',
      ),
    ).resolves.toBeUndefined();

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'SMTP credentials not configured — emails will not be sent',
    );
    await module.close();
  });

  it('sanitizes HTML and includes a bilingual transactional footer', async () => {
    mockSendMail.mockResolvedValueOnce({ accepted: ['recipient'] });
    const { module, service } = await createService({
      SMTP_HOST: 'smtp.example.test',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });

    await service.sendEmail(
      'recipient@mrh-academy.example',
      'Welcome <script>alert(1)</script>',
      '<div dir="rtl">مرحبًا</div><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>',
    );
    await jest.runAllTimersAsync();

    const message = mockSendMail.mock.calls[0][0] as { html: string };
    expect(message.html).toContain('هذه رسالة آلية');
    expect(message.html).toContain('This is a transactional message');
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('javascript:');
    await module.close();
  });
});
