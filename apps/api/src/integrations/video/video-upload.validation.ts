import { BadRequestException } from '@nestjs/common';

export const MAX_SECURE_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

export function validateVideoUpload(
  file?: UploadFile,
): asserts file is UploadFile {
  if (!file) throw new BadRequestException('A video file is required');
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException('Video must be MP4, WebM, or MOV');
  }
  if (file.size <= 0 || file.size > MAX_SECURE_VIDEO_BYTES) {
    throw new BadRequestException('Video must be 250MB or smaller');
  }

  const isIsoMedia =
    file.buffer.length >= 12 &&
    file.buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  const isWebm =
    file.buffer.length >= 4 &&
    file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!isIsoMedia && !isWebm) {
    throw new BadRequestException('The uploaded file is not a valid video');
  }
}

export function validateCaptionUpload(
  file: UploadFile | undefined,
  languageValue: string | undefined,
  labelValue: string | undefined,
) {
  if (!file) throw new BadRequestException('A WebVTT caption file is required');
  if (file.size <= 0 || file.size > MAX_CAPTION_BYTES) {
    throw new BadRequestException('Captions must be 2MB or smaller');
  }
  const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (
    !['text/vtt', 'text/plain', 'application/octet-stream'].includes(
      file.mimetype,
    ) ||
    !content.startsWith('WEBVTT')
  ) {
    throw new BadRequestException('Captions must be a valid WebVTT file');
  }

  const language = (languageValue ?? '').trim();
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) {
    throw new BadRequestException(
      'Caption language must be a valid code such as ar or en-US',
    );
  }
  const label = (labelValue ?? language).trim();
  if (!label || label.length > 100) {
    throw new BadRequestException(
      'Caption label must be between 1 and 100 characters',
    );
  }
  return { language, label };
}
