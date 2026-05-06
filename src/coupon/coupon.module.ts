import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { PublicCouponController } from './public-coupon.controller';

@Module({
  imports: [PrismaModule],
  providers: [CouponService],
  controllers: [CouponController, PublicCouponController],
  exports: [CouponService],
})
export class CouponModule {}
