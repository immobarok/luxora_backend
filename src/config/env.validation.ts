import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MinLength,
  validateSync,
  IsNotIn,
} from 'class-validator';

/**
 * Environment variable validation schema.
 *
 * Validated at application startup via ConfigModule.forRoot({ validate }).
 * Any missing or invalid variable will throw a fatal error and prevent boot.
 */
class EnvironmentVariables {
  // ── Database ───────────────────────────────────────────────────────────────
  @IsString()
  DATABASE_URL: string;

  // ── JWT ───────────────────────────────────────────────────────────────────
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters for security',
  })
  @IsNotIn(['demo-jwt-secret-key', 'secret', 'changeme', 'jwt-secret'], {
    message:
      'JWT_SECRET is using a known insecure default. Please set a strong random secret.',
  })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN?: string;

  // ── Redis ─────────────────────────────────────────────────────────────────
  @IsString()
  REDIS_URL: string;

  // ── Server ────────────────────────────────────────────────────────────────
  @IsNumber()
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  HOST?: string;

  @IsString()
  @IsIn(['development', 'production', 'test'], {
    message: 'NODE_ENV must be one of: development, production, test',
  })
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // ── Mail ──────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  MAIL_HOST?: string;

  @IsNumber()
  @IsOptional()
  MAIL_PORT?: number;

  @IsString()
  @IsOptional()
  MAIL_USER?: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  // ── OTP ───────────────────────────────────────────────────────────────────
  @IsNumber()
  @IsOptional()
  OTP_EXPIRY_SECONDS?: number;

  // ── Cloudinary ────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY?: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET?: string;

  // ── Stripe ────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  // ── OAuth ─────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_CLIENT_SECRET?: string;

  // ── Frontend ──────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL?: number;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX?: number;
}

/**
 * Validates process.env against EnvironmentVariables schema.
 * Called by ConfigModule.forRoot({ validate: validateEnv }).
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`❌ Environment validation failed:\n${messages}`);
  }

  // Extra production-only checks
  if (
    validatedConfig.NODE_ENV === 'production' &&
    validatedConfig.CORS_ORIGINS === '*'
  ) {
    throw new Error(
      '❌ CORS_ORIGINS cannot be wildcard (*) in production. Set specific allowed origins.',
    );
  }

  return validatedConfig;
}
