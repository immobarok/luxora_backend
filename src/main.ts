import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { AppModule } from './app.module';
import helmet from 'helmet';
import hpp from 'hpp';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // ── Create Application ─────────────────────────────────────────────
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // ── Global Prefix ──────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: [],
  });

  // ── API Versioning ─────────────────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Trust Proxy (for correct IP behind load-balancers) ─────────────
  const expressApp = app
    .getHttpAdapter()
    .getInstance() as import('express').Express;
  expressApp.set('trust proxy', 1);

  // ── HTTP Parameter Pollution Protection ────────────────────────────
  // Prevents attackers from sending duplicate query parameters
  // e.g. ?role=ADMIN&role=CUSTOMER → only the last value survives
  app.use(hpp());

  // ── Cookie Parser ──────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Security Headers (Helmet) ──────────────────────────────────────
  // Applied BEFORE routes — must come before body parsers
  app.use(
    helmet({
      // Content-Security-Policy — restricts resource origins
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Strict-Transport-Security — enforces HTTPS for 1 year
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      // Prevents MIME-type sniffing
      noSniff: true,
      // Clickjacking protection
      frameguard: { action: 'sameorigin' },
      // Removes X-Powered-By: Express header (hides server info)
      hidePoweredBy: true,
      // XSS filter — disable legacy auditor; rely on CSP instead
      xssFilter: true,
      // Referrer-Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Permissions-Policy — restrict browser features
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      crossOriginEmbedderPolicy: false, // Allow embedding in iframes from same origin
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────
  const allowedOrigins = configService.get<string>('CORS_ORIGINS', '');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Fail fast if wildcard CORS is used in production
  if (isProduction && (!allowedOrigins || allowedOrigins === '*')) {
    logger.error(
      '❌ CORS_ORIGINS must be set to explicit origins in production. Wildcard (*) is not allowed.',
    );
    process.exit(1);
  }

  app.enableCors({
    origin:
      !allowedOrigins || allowedOrigins === '*'
        ? true // Development: allow all origins
        : allowedOrigins.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Requested-With',
      'X-Guest-Id',
      'Accept',
    ],
    exposedHeaders: ['X-Correlation-Id'],
    credentials: true,
    maxAge: 3600,
  });

  // ── Global Pipes ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown fields
      transform: true, // Auto-transform types
      forbidNonWhitelisted: true, // Reject requests with unknown fields
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global Filters (outermost → innermost) ─────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // ── Graceful Shutdown ──────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Body Size Limits ───────────────────────────────────────────────
  const bodyLimit = configService.get<string>('BODY_LIMIT', '10mb');
  const { json, urlencoded } = await import('express');
  app.use(
    json({
      limit: bodyLimit,
      verify: (req: any, _res, buf) => {
        // Preserve the raw body for Stripe webhook signature verification
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // ── Redis WebSocket Adapter ────────────────────────────────────────
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // ── Swagger API Documentation ────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Luxora API')
      .setDescription('The robust backend API for Luxora E-commerce platform.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Start Server ───────────────────────────────────────────────────
  const port = configService.get<number>('PORT', 3000);
  const host = configService.get<string>('HOST', '0.0.0.0');

  await app.listen(port, host);

  const url = await app.getUrl();
  logger.log(`🚀 Application running on: ${url}`);
  logger.log(`📄 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`🔗 API Base: ${url}/api/v1`);
  logger.log(`🔐 Security: Helmet CSP ✓ | Rate Limiting ✓ | HPP ✓`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Application failed to start', err.stack ?? err);
  process.exit(1);
});
