import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface EmailTask {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  retries: number;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private mailTransporter: nodemailer.Transporter;
  private isConfigured = false;
  private queue: EmailTask[] = [];
  private processing = false;

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
    this.queue.push({ to, subject, html, retries: 0 });
    this.processQueue();
  }

  async sendPlainEmail(to: string, subject: string, text: string) {
    if (!this.isConfigured) {
      this.logger.debug(`[Email skipped] To: ${to} | Subject: ${subject}`);
      return;
    }
    this.queue.push({ to, subject, text, retries: 0 });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        if (task.html) {
          await this.mailTransporter.sendMail({
            from:
              this.configService.get<string>('SMTP_FROM') ||
              'no-reply@mrh-academy.com',
            to: task.to,
            subject: task.subject,
            html: task.html,
          });
        } else {
          await this.mailTransporter.sendMail({
            from:
              this.configService.get<string>('SMTP_FROM') ||
              'no-reply@mrh-academy.com',
            to: task.to,
            subject: task.subject,
            text: task.text,
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${task.to}: ${task.subject}`,
          error,
        );
        if (task.retries < MAX_RETRIES) {
          this.logger.warn(`Retrying (${task.retries + 1}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          this.queue.unshift({ ...task, retries: task.retries + 1 });
        }
      }
    }

    this.processing = false;
  }
}
