import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadedFileResult } from './storage.interface';
import { MediaConfig } from '../config/media.config';

@Injectable()
export class CloudinaryProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(private configService: ConfigService) {
    const config = this.configService.get<MediaConfig>('media');
    
    if (!config) {
      throw new Error('Media config is undefined');
    }

    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
    });
    
    this.logger.log(`Cloudinary configured with cloud name: ${config.CLOUDINARY_CLOUD_NAME}`);
  }

  async upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadedFileResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: key,
          resource_type: this.getResourceType(mimeType),
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Upload failed for key: ${key}`, error);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Upload to Cloudinary returned undefined result'));
          }
          resolve({
            key: result.public_id,
            url: result.secure_url,
            category: this.getCategory(mimeType),
            size: result.bytes,
            mimeType: mimeType,
            etag: result.etag,
          });
        }
      );
      
      uploadStream.end(buffer);
    });
  }

  async uploadMany(
    files: { buffer: Buffer; key: string; mimeType: string }[],
  ): Promise<UploadedFileResult[]> {
    const promises = files.map((file) =>
      this.upload(file.buffer, file.key, file.mimeType),
    );
    return Promise.all(promises);
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(key, (error, result) => {
        if (error) {
          this.logger.error(`Delete failed for key: ${key}`, error);
          return reject(error);
        }
        this.logger.log(`Deleted key: ${key}, result: ${result.result}`);
        resolve();
      });
    });
  }

  async deleteMany(keys: string[]): Promise<void> {
    const promises = keys.map((key) => this.delete(key));
    await Promise.all(promises);
  }

  getPublicUrl(key: string): string {
    return cloudinary.url(key, { secure: true });
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return cloudinary.url(key, { secure: true, sign_url: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await cloudinary.api.resource(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  private getResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'video';
    return 'raw';
  }

  private getCategory(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'video';
    return 'document';
  }
}
