import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadedFile } from '../types/uploaded-file.type';

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

@Injectable()
export class FileValidatorService {
  private readonly defaultMaxSize: number;
  private readonly defaultImageTypes: string[];
  private readonly defaultVideoTypes: string[];

  constructor(private readonly configService: ConfigService) {
    this.defaultMaxSize = this.configService.get<number>(
      'media.MAX_FILE_SIZE',
      5 * 1024 * 1024,
    );
    this.defaultImageTypes = this.configService.get<string[]>(
      'media.ALLOWED_IMAGE_TYPES',
      [],
    );
    this.defaultVideoTypes = this.configService.get<string[]>(
      'media.ALLOWED_VIDEO_TYPES',
      [],
    );
  }

  validate(file: UploadedFile, options?: FileValidationOptions): void {
    const maxSize = options?.maxSize ?? this.defaultMaxSize;
    const allowedTypes = options?.allowedTypes ?? [
      ...this.defaultImageTypes,
      ...this.defaultVideoTypes,
    ];

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      throw new BadRequestException(
        `File "${file.originalname}" is too large. Maximum size: ${maxSizeMB}MB`,
      );
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    if (options?.allowedExtensions) {
      const ext = file.originalname.toLowerCase().split('.').pop();
      if (!options.allowedExtensions.includes(`.${ext}`)) {
        throw new BadRequestException(
          `Invalid file extension ".${ext}". Allowed: ${options.allowedExtensions.join(', ')}`,
        );
      }
    }
  }

  validateMany(files: UploadedFile[], options?: FileValidationOptions): void {
    if (!files?.length) {
      throw new BadRequestException('No files provided');
    }

    files.forEach((file) => this.validate(file, options));
  }

  getCategory(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
