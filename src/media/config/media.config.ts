import { registerAs } from '@nestjs/config';
import { IsString, IsNumber, IsBoolean, validateSync } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

const toCsvList = (value: unknown, fallback: string[]): string[] => {
  if (typeof value !== 'string') return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export class MediaConfig {
  @IsString()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  CLOUDINARY_API_SECRET!: string;

  @IsNumber()
  @Transform(({ value }: { value: unknown }) =>
    toNumber(value, 5 * 1024 * 1024),
  )
  MAX_FILE_SIZE: number = 5 * 1024 * 1024; // 5MB default

  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => toCsvList(value, [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]))
  ALLOWED_IMAGE_TYPES: string[] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ];

  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => toCsvList(value, [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/webm',
  ]))
  ALLOWED_VIDEO_TYPES: string[] = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/webm',
  ];
}

export const validateMediaConfig = (
  config: Record<string, unknown>,
): MediaConfig => {
  const validated = plainToInstance(MediaConfig, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Media config validation failed: ${errors.toString()}`);
  }

  return validated;
};

export default registerAs('media', () => {
  return validateMediaConfig({
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
    ALLOWED_IMAGE_TYPES: process.env.ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES: process.env.ALLOWED_VIDEO_TYPES,
  });
});
