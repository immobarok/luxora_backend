import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'src/common/decorators';
import { CouponService } from './coupon.service';
import { ApplyCouponDto } from './dto';

interface RequestWithOptionalUser extends Request {
  user?: { id: string };
}

@Controller('coupons')
export class PublicCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post('apply')
  @Public()
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @Req() req: RequestWithOptionalUser,
  ) {
    return this.couponService.calculateDiscountForCart(
      dto.cartId,
      dto.code,
      req.user?.id,
    );
  }
}
