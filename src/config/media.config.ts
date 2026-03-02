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

const toCsvList = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export class MediaConfig {
  @IsString()
  MINIO_ENDPOINT!: string;

  @IsNumber()
  @Transform(({ value }: { value: unknown }) => toNumber(value, 9000))
  MINIO_PORT: number = 9000;

  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => toBoolean(value, false))
  MINIO_USE_SSL: boolean = false;

  @IsString()
  MINIO_ACCESS_KEY!: string;

  @IsString()
  MINIO_SECRET_KEY!: string;

  @IsString()
  MINIO_BUCKET!: string;

  @IsNumber()
  @Transform(({ value }: { value: unknown }) =>
    toNumber(value, 5 * 1024 * 1024),
  )
  MAX_FILE_SIZE: number = 5 * 1024 * 1024; // 5MB default

  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => toCsvList(value))
  ALLOWED_IMAGE_TYPES: string[] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/avif',
  ];

  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => toCsvList(value))
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
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_PORT: process.env.MINIO_PORT,
    MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
    ALLOWED_IMAGE_TYPES: process.env.ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES: process.env.ALLOWED_VIDEO_TYPES,
  });
});
