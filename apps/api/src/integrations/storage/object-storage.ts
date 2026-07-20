export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export type UploadOptions = {
  folder: string;
  resourceType?: 'image' | 'raw' | 'auto';
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
    options?: { resourceType?: string; transformation?: object[] },
  ): string;
}
