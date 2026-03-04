import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, Roles } from '../common/decorators/roles.decorator';
import { CreateCouponDto, UpdateCouponDto } from './dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  async listCoupons() {
    return this.couponService.listCoupons();
  }

  @Post()
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @Req() req: RequestWithUser,
  ) {
    return this.couponService.createCoupon(req.user.id, dto);
  }

  @Patch(':id')
  async updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.updateCoupon(id, dto);
  }

  @Patch(':id/toggle')
  async toggleCoupon(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.couponService.toggleCoupon(id, body.isActive);
  }
}
