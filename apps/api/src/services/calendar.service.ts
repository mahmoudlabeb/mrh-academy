import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { randomUUID, createHash } from 'node:crypto';

export type LessonMeetLinkInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  tutorEmail: string;
  studentEmail: string;
};

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly configService: ConfigService) {}

  isGoogleMeetConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
        this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') &&
        this.configService.get<string>('GOOGLE_CALENDAR_IMPERSONATE_EMAIL'),
    );
  }

  private getPrivateKey(): string {
    const raw = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      '',
    );
    return raw.replace(/\\n/g, '\n');
  }

  /**
   * Generates a free Jitsi Meet link as a fallback when Google Meet
   * is not configured (no Google Workspace subscription required).
   * Room names are unique per lesson using a hash for security.
   */
  generateJitsiMeetLink(input: LessonMeetLinkInput): string {
    const uniqueData = `${input.tutorEmail}-${input.studentEmail}-${input.start.toISOString()}-${randomUUID()}`;
    const hash = createHash('sha256').update(uniqueData).digest('hex').substring(0, 12);
    const roomName = `MRH-Lesson-${hash}`;
    return `https://meet.jit.si/${roomName}`;
  }

  async createLessonMeetLink(
    input: LessonMeetLinkInput,
  ): Promise<string | null> {
    // If Google Meet is configured, use it as the primary provider
    if (this.isGoogleMeetConfigured()) {
      try {
        const auth = new google.auth.JWT({
          email: this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
          key: this.getPrivateKey(),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: this.configService.get<string>(
            'GOOGLE_CALENDAR_IMPERSONATE_EMAIL',
          ),
        });

        const calendar = google.calendar({ version: 'v3', auth });
        const requestId = randomUUID();

        const response = await calendar.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {
            summary: input.summary,
            description: input.description,
            start: {
              dateTime: input.start.toISOString(),
              timeZone: 'UTC',
            },
            end: {
              dateTime: input.end.toISOString(),
              timeZone: 'UTC',
            },
            attendees: [
              { email: input.tutorEmail },
              { email: input.studentEmail },
            ],
            conferenceData: {
              createRequest: {
                requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          },
        });

        const meetUrl =
          response.data.hangoutLink ||
          response.data.conferenceData?.entryPoints?.find(
            (entry) => entry.entryPointType === 'video',
          )?.uri ||
          null;

        if (meetUrl) {
          this.logger.log('Google Meet link created successfully.');
          return meetUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Google Meet link creation failed, falling back to Jitsi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Fallback: generate a free Jitsi Meet link
    const jitsiUrl = this.generateJitsiMeetLink(input);
    this.logger.log(`Jitsi Meet link generated: ${jitsiUrl}`);
    return jitsiUrl;
  }

  private escapeIcsText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  generateIcs(event: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    location?: string;
    uid?: string;
  }): string {
    const uid =
      event.uid ||
      `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@mrhacademy.com`;
    const formatDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const now = formatDate(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mr.H Academy//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDate(event.start)}`,
      `DTEND:${formatDate(event.end)}`,
      `SUMMARY:${this.escapeIcsText(event.summary)}`,
      `DESCRIPTION:${this.escapeIcsText(event.description)}`,
      ...(event.location
        ? [`LOCATION:${this.escapeIcsText(event.location)}`]
        : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
}
