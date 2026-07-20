import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type {
  ObjectStorage,
  StoredObject,
  UploadOptions,
} from './object-storage.js';

@Injectable()
export class CloudinaryObjectStorage implements ObjectStorage {
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async upload(buffer: Buffer, options: UploadOptions): Promise<StoredObject> {
    if (!this.configured) throw new Error('Object storage is not configured');
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: options.folder,
            resource_type: options.resourceType ?? 'auto',
            ...(options.accessMode ? { access_mode: options.accessMode } : {}),
          },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              reject(
                error instanceof Error
                  ? error
                  : new Error('Object upload failed'),
              );
              return;
            }
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
              pages: result.pages,
            });
          },
        )
        .end(buffer);
    });
  }

  async destroy(publicId: string, options: { resourceType?: string } = {}) {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(publicId, {
      resource_type: options.resourceType ?? 'image',
      type: 'authenticated',
    });
  }

  signedUrl(
    publicId: string,
    options: { resourceType?: string; transformation?: object[] } = {},
  ) {
    return cloudinary.url(publicId, {
      resource_type: options.resourceType ?? 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      transformation: options.transformation,
    });
  }
}
