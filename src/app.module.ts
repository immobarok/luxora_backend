import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import {
  LoggingInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
  ErrorInterceptor,
  PerformanceInterceptor,
} from './common/interceptors';
import {
  CorrelationIdMiddleware,
  HelmetHeadersMiddleware,
  SanitizeMiddleware,
  SecurityAuditMiddleware,
} from './common/middleware';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { MailModule } from './mail/mail.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { CouponModule } from './coupon/coupon.module';
import { ChatModule } from './chat/chat.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AddressModule } from './address/address.module';
import { StripeModule } from './stripe/stripe.module';
import { AboutModule } from './about/about.module';
import { BannerModule } from './banner/banner.module';
import { BlogModule } from './blog/blog.module';
import { CustomerModule } from './customer/customer.module';
import { UserModule } from './user/user.module';
import { AnnouncementModule } from './announcement/announcement.module';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // ── Rate Limiting (Redis-backed) ────────────────────────────────────────
    // Global: 100 requests per minute per IP
    // Auth routes apply stricter @Throttle({ default: { limit: 5, ttl: 60000 } })
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('RATE_LIMIT_TTL', 60_000),
            limit: configService.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(configService.get<string>('REDIS_URL', '')),
        ),
      }),
    }),

    PrismaModule,
    AuthModule,
    RedisModule,
    MailModule,
    ProductModule,
    CategoryModule,
    BrandModule,
    CartModule,
    OrderModule,
    CouponModule,
    ChatModule,
    DashboardModule,
    AddressModule,
    StripeModule,
    AboutModule,
    BannerModule,
    BlogModule,
    CustomerModule,
    UserModule,
    AnnouncementModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // --- Rate Limiting Guard (must be first) ---
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    // --- Global Guards ---
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // --- Global Interceptors (order matters – first registered = outermost) ---
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PerformanceInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ErrorInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        // Security audit must be first (log raw incoming request)
        SecurityAuditMiddleware,
        // Correlation ID for tracing
        CorrelationIdMiddleware,
        // Security headers (X-Frame-Options, HSTS, etc.)
        HelmetHeadersMiddleware,
        // XSS sanitization of body/query strings
        SanitizeMiddleware,
      )
      .forRoutes('*');
  }
}
