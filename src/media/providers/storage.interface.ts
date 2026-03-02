export interface UploadedFileResult {
  key: string;
  url: string;
  category: 'image' | 'video' | 'document';
  size: number;
  mimeType: string;
  etag?: string;
}

export interface StorageProvider {
  upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadedFileResult>;
  uploadMany(
    files: { buffer: Buffer; key: string; mimeType: string }[],
  ): Promise<UploadedFileResult[]>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  getPublicUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
