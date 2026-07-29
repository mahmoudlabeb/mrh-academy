import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import sanitizeHtml from 'sanitize-html';

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
      connectionTimeout: Number(
        this.configService.get<string>('SMTP_CONNECTION_TIMEOUT_MS') ?? 5000,
      ),
      greetingTimeout: Number(
        this.configService.get<string>('SMTP_GREETING_TIMEOUT_MS') ?? 5000,
      ),
      socketTimeout: Number(
        this.configService.get<string>('SMTP_SOCKET_TIMEOUT_MS') ?? 10000,
      ),
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
    this.queue.push({
      to,
      subject,
      html: this.renderTemplate(subject, html),
      text: sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }),
      retries: 0,
    });
    this.processQueue();
  }

  async sendPlainEmail(to: string, subject: string, text: string) {
    if (!this.isConfigured) {
      this.logger.debug(`[Email skipped] To: ${to} | Subject: ${subject}`);
      return;
    }
    const safeText = sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    });
    const html = safeText
      .split(/\r?\n\r?\n/)
      .map((paragraph) => `<p>${paragraph.replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
    this.queue.push({
      to,
      subject,
      text,
      html: this.renderTemplate(subject, html),
      retries: 0,
    });
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
            text: task.text,
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

  private renderTemplate(subject: string, content: string) {
    const safeSubject = sanitizeHtml(subject, {
      allowedTags: [],
      allowedAttributes: {},
    });
    const safeContent = sanitizeHtml(content, {
      allowedTags: [
        'div',
        'p',
        'a',
        'hr',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'br',
      ],
      allowedAttributes: {
        div: ['dir', 'lang'],
        p: ['dir', 'lang'],
        a: ['href'],
      },
      allowedSchemes: ['https', 'http'],
    });
    return `<!doctype html>
<html lang="ar">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#172033">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f3f4f6">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden">
          <tr><td style="padding:24px 30px;background:#172033;color:#fff;font-size:22px;font-weight:700">MRH Academy</td></tr>
          <tr><td style="padding:30px;font-size:16px;line-height:1.65">${safeContent}</td></tr>
          <tr><td style="padding:20px 30px;background:#f8fafc;color:#667085;font-size:12px;line-height:1.5"><div dir="rtl">هذه رسالة آلية تخص حسابك أو نشاطك في أكاديمية MRH. لا تشارك روابط الأمان أو الرموز.</div><div dir="ltr">This is a transactional message about your MRH Academy account or activity. Do not share security links or codes.</div></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }
}
