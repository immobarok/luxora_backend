import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { UploadedFile } from '../types/uploaded-file.type';

export interface PathConfig {
  category: 'image' | 'video' | 'document';
  folder?: string;
  preserveOriginalName?: boolean;
}

@Injectable()
export class PathGeneratorService {
  generate(originalName: string, config: PathConfig): string {
    const timestamp = Date.now();
    const uuid = randomUUID().split('-')[0];
    const ext = extname(originalName).toLowerCase();

    const sanitizedName = config.preserveOriginalName
      ? this.sanitizeName(originalName)
      : `${uuid}${ext}`;

    const basePath = `${config.category}s`;
    const folderPath = config.folder
      ? `${basePath}/${config.folder}`
      : basePath;

    return `${folderPath}/${timestamp}-${sanitizedName}`;
  }

  generateMany(
    files: UploadedFile[],
    config: Omit<PathConfig, 'category'>,
  ): string[] {
    return files.map((file) => {
      const category = this.detectCategory(file.mimetype);
      return this.generate(file.originalname, { ...config, category });
    });
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-{2,}/g, '-')
      .substring(0, 100);
  }

  private detectCategory(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
