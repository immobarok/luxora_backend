// src/order/dto/checkout.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodType } from '@prisma/client';
import { Type } from 'class-transformer';
import { AddressInputDto } from './address.dto';

export { PaymentMethodType as PaymentMethod };

export class CheckoutDto {
  @IsUUID()
  @IsOptional()
  shippingAddressId?: string;

  @ValidateNested()
  @Type(() => AddressInputDto)
  @IsOptional()
  shippingAddress?: AddressInputDto;

  @IsUUID()
  @IsOptional()
  billingAddressId?: string;

  @ValidateNested()
  @Type(() => AddressInputDto)
  @IsOptional()
  billingAddress?: AddressInputDto;

  @IsEnum(PaymentMethodType)
  @IsNotEmpty()
  paymentMethod!: PaymentMethodType;

  @IsString()
  @IsNotEmpty()
  paymentToken!: string; // Stripe token, etc.

  @IsString()
  @IsOptional()
  couponCode?: string;
}
