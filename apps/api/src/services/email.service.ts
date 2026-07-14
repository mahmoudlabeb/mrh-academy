import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private mailTransporter: nodemailer.Transporter;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    this.isConfigured = !!(smtpUser && smtpPass);

    this.mailTransporter = nodemailer.createTransport({
      host:
        this.configService.get<string>('SMTP_HOST') || 'smtp.ethereal.email',
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: this.isConfigured ? { user: smtpUser, pass: smtpPass } : undefined,
    } as nodemailer.TransportOptions);
  }

  async onModuleInit() {
    if (!this.isConfigured) {
      this.logger.warn(
        'SMTP credentials not configured — emails will not be sent',
      );
      return;
    }
    try {
      await this.mailTransporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (err) {
      this.logger.error('SMTP connection failed', err);
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.isConfigured) {
      this.logger.debug(`[Email skipped] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.mailTransporter.sendMail({
        from:
          this.configService.get<string>('SMTP_FROM') ||
          'no-reply@mrh-academy.com',
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${subject}`, error);
    }
  }

  async sendPlainEmail(to: string, subject: string, text: string) {
    if (!this.isConfigured) {
      this.logger.debug(`[Email skipped] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.mailTransporter.sendMail({
        from:
          this.configService.get<string>('SMTP_FROM') ||
          'no-reply@mrh-academy.com',
        to,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send plain email to ${to}: ${subject}`,
        error,
      );
    }
  }
}
