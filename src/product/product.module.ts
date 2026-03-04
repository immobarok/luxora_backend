import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { AdminCartSettingsController } from './admin-cart-settings.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    PrismaModule,
    MediaModule,
    CacheModule.register({ ttl: 300 }),
    CartModule,
  ],
  controllers: [ProductController, AdminCartSettingsController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
