import { Injectable } from '@nestjs/common';

@Injectable()
export class CalendarService {
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
    const uid = event.uid || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@mrhacademy.com`;
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
      ...(event.location ? [`LOCATION:${this.escapeIcsText(event.location)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
}
