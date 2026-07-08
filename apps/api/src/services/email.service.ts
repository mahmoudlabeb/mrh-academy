import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private mailTransporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      this.mailTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return;
    }

    this.mailTransporter = nodemailer.createTransport({
      host:
        this.configService.get<string>('SMTP_HOST') || 'smtp.ethereal.email',
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    } as nodemailer.TransportOptions);
  }

  async sendEmail(to: string, subject: string, html: string) {
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
      console.error('Failed to send HTML email:', error);
    }
  }

  async sendPlainEmail(to: string, subject: string, text: string) {
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
      console.error('Failed to send plain email:', error);
    }
  }
}
