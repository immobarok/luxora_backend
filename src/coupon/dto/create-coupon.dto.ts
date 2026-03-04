import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minPurchase?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxDiscount?: number;

  @IsString()
  @IsOptional()
  appliesTo?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  @IsOptional()
  targetIds?: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  usageLimit?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  perUserLimit?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  newCustomersOnly?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresLogin?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
