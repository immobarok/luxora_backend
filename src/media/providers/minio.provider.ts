import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageProvider, UploadedFileResult } from './storage.interface';

@Injectable()
export class MinioProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioProvider.name);
  private client!: Minio.Client;
  private bucket: string;
  private endpoint: string;
  private useSSL: boolean;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('media.MINIO_BUCKET');
    this.endpoint = this.configService.getOrThrow<string>(
      'media.MINIO_ENDPOINT',
    );
    this.useSSL = this.configService.get<boolean>('media.MINIO_USE_SSL', false);
  }

  async onModuleInit(): Promise<void> {
    this.initializeClient();
    await this.validateBucket();
    await this.configurePublicAccess();
  }

  private initializeClient(): void {
    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.configService.getOrThrow<number>('media.MINIO_PORT'),
      useSSL: this.useSSL,
      accessKey: this.configService.getOrThrow<string>(
        'media.MINIO_ACCESS_KEY',
      ),
      secretKey: this.configService.getOrThrow<string>(
        'media.MINIO_SECRET_KEY',
      ),
    });

    this.logger.log(`MinIO client initialized: ${this.endpoint}`);
  }

  private async validateBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);

    if (!exists) {
      this.logger.log(`Creating bucket: ${this.bucket}`);
      await this.client.makeBucket(this.bucket, 'us-east-1');
    }

    this.logger.log(`Bucket ready: ${this.bucket}`);
  }

  private async configurePublicAccess(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };

    try {
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
      this.logger.log('Public read access configured');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to set bucket policy: ${message}`);
    }
  }

  async upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadedFileResult> {
    const uploadInfo = await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      { 'Content-Type': mimeType },
    );
    const etag = typeof uploadInfo === 'string' ? uploadInfo : uploadInfo.etag;

    return {
      key,
      url: this.getPublicUrl(key),
      category: this.categorizeFile(mimeType),
      size: buffer.length,
      mimeType,
      etag,
    };
  }

  async uploadMany(
    files: { buffer: Buffer; key: string; mimeType: string }[],
  ): Promise<UploadedFileResult[]> {
    const results = await Promise.all(
      files.map((f) => this.upload(f.buffer, f.key, f.mimeType)),
    );
    return results;
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.client.removeObjects(this.bucket, keys);
  }

  getPublicUrl(key: string): string {
    const protocol = this.useSSL ? 'https' : 'http';
    const port = this.configService.get<number>('media.MINIO_PORT');
    return `${protocol}://${this.endpoint}:${port}/${this.bucket}/${key}`;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  private categorizeFile(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
