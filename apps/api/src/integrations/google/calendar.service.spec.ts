import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service.js';

describe('CalendarService', () => {
  const input = {
    summary: 'Arabic; English, lesson',
    description: 'Line one\nLine two',
    start: new Date('2026-07-29T10:00:00Z'),
    end: new Date('2026-07-29T11:00:00Z'),
    tutorEmail: 'tutor@mrh-academy.example',
    studentEmail: 'student@mrh-academy.example',
  };

  const createService = (values: Record<string, string> = {}) =>
    new CalendarService({
      get: jest.fn((key: string, fallback = '') => values[key] ?? fallback),
    } as unknown as ConfigService);

  it('uses the authenticated internal classroom when Google Meet is absent', async () => {
    const service = createService();

    expect(service.isGoogleMeetConfigured()).toBe(false);
    await expect(service.createLessonMeetLink(input)).resolves.toBeNull();
  });

  it('only reports Google Meet configured when all service-account values exist', () => {
    const service = createService({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'service@example.test',
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'private-key',
      GOOGLE_CALENDAR_IMPERSONATE_EMAIL: 'calendar@example.test',
    });

    expect(service.isGoogleMeetConfigured()).toBe(true);
  });

  it('generates standards-compatible ICS content with escaped user text', () => {
    const service = createService();
    const ics = service.generateIcs({
      summary: input.summary,
      description: input.description,
      start: input.start,
      end: input.end,
      location: 'Room, 1',
      uid: 'lesson-1@example.test',
    });

    expect(ics).toContain('UID:lesson-1@example.test');
    expect(ics).toContain('DTSTART:20260729T100000Z');
    expect(ics).toContain('SUMMARY:Arabic\\; English\\, lesson');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
    expect(ics).toContain('LOCATION:Room\\, 1');
  });
});
