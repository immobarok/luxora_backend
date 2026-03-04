import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCouponDto } from './create-coupon.dto';

export class UpdateCouponDto implements Partial<CreateCouponDto> {
  @IsOptional()
  code?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  type?: CreateCouponDto['type'];

  @IsOptional()
  value?: number;

  @IsOptional()
  minPurchase?: number;

  @IsOptional()
  maxDiscount?: number;

  @IsOptional()
  appliesTo?: string;

  @IsOptional()
  targetIds?: string[];

  @IsOptional()
  usageLimit?: number;

  @IsOptional()
  perUserLimit?: number;

  @IsOptional()
  startsAt?: string;

  @IsOptional()
  expiresAt?: string;

  @IsOptional()
  newCustomersOnly?: boolean;

  @IsOptional()
  requiresLogin?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
