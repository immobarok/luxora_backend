import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartSettingsService } from './cart-settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [PrismaModule, CouponModule],
  controllers: [CartController],
  providers: [CartService, CartSettingsService],
  exports: [CartService, CartSettingsService],
})
export class CartModule {}
