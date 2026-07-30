import { BadRequestException } from '@nestjs/common';
import {
  MAX_SECURE_VIDEO_BYTES,
  validateCaptionUpload,
  validateVideoUpload,
} from './video-upload.validation.js';

const mp4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftyp'),
  Buffer.from('isom0000'),
]);

describe('secure video upload validation', () => {
  it('accepts a signature-verified MP4 upload', () => {
    expect(() =>
      validateVideoUpload({
        buffer: mp4,
        mimetype: 'video/mp4',
        size: mp4.length,
      }),
    ).not.toThrow();
  });

  it.each([
    ['spoofed MIME', Buffer.from('not-video'), 'video/mp4', 9],
    ['unsupported type', mp4, 'video/x-msvideo', mp4.length],
    ['oversized upload', mp4, 'video/mp4', MAX_SECURE_VIDEO_BYTES + 1],
  ])('rejects a %s', (_name, buffer, mimetype, size) => {
    expect(() => validateVideoUpload({ buffer, mimetype, size })).toThrow(
      BadRequestException,
    );
  });

  it('accepts valid WebVTT captions and normalizes their metadata', () => {
    const buffer = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nHello');
    expect(
      validateCaptionUpload(
        {
          buffer,
          mimetype: 'text/vtt',
          size: buffer.length,
        },
        'en-US',
        'English',
      ),
    ).toEqual({ language: 'en-US', label: 'English' });
  });

  it('rejects invalid caption content and language codes', () => {
    const invalid = Buffer.from('00:00.000 --> 00:01.000\nHello');
    expect(() =>
      validateCaptionUpload(
        { buffer: invalid, mimetype: 'text/vtt', size: invalid.length },
        'english',
        'English',
      ),
    ).toThrow(BadRequestException);
  });
});
