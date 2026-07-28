export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export type UploadOptions = {
  folder: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  accessMode?: 'public' | 'authenticated';
};

export type StoredObject = {
  publicId: string;
  secureUrl: string;
  pages?: number;
};

export interface ObjectStorage {
  upload(buffer: Buffer, options: UploadOptions): Promise<StoredObject>;
  destroy(publicId: string, options?: { resourceType?: string }): Promise<void>;
  signedUrl(
    publicId: string,
    options?: {
      resourceType?: string;
      deliveryType?: 'upload' | 'authenticated';
      transformation?: object[];
    },
  ): string;
}
