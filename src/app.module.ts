import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  ErrorInterceptor,
  LoggingInterceptor,
  PerformanceInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
} from './common/interceptors';
import {
  CorrelationIdMiddleware,
  HelmetHeadersMiddleware,
  SanitizeMiddleware,
  SecurityAuditMiddleware,
} from './common/middleware';
import { PrismaModule } from './prisma/prisma.module';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AboutModule } from './about/about.module';
import { AddressModule } from './address/address.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BannerModule } from './banner/banner.module';
import { BlogModule } from './blog/blog.module';
import { BrandModule } from './brand/brand.module';
import { CartModule } from './cart/cart.module';
import { CategoryModule } from './category/category.module';
import { ChatModule } from './chat/chat.module';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { validateEnv } from './config/env.validation';
import { CouponModule } from './coupon/coupon.module';
import { CustomerModule } from './customer/customer.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { ProfileModule } from './profile/profile.module';
import { RedisModule } from './redis/redis.module';
import { StripeModule } from './stripe/stripe.module';
import { UserModule } from './user/user.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewModule } from './review/review.module';
import { ReturnsModule } from './returns/returns.module';
import { ContactModule } from './contact/contact.module';
import { NotificationModule } from './notification/notification.module';
import { AdminActionModule } from './admin-action/admin-action.module';
import { ShipmentModule } from './shipment/shipment.module';

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
    ProfileModule,
    WishlistModule,
    ReviewModule,
    ReturnsModule,
    ContactModule,
    NotificationModule,
    AdminActionModule,
    ShipmentModule,
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
