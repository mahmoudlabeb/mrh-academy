import { Module } from '@nestjs/common';
import { CloudinaryObjectStorage } from './cloudinary.object-storage.js';
import { OBJECT_STORAGE } from './object-storage.js';

@Module({
  providers: [
    CloudinaryObjectStorage,
    { provide: OBJECT_STORAGE, useExisting: CloudinaryObjectStorage },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
