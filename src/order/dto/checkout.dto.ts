// src/order/dto/checkout.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export { PaymentMethodType as PaymentMethod };

export class CheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  shippingAddressId!: string;

  @IsUUID()
  @IsOptional()
  billingAddressId?: string;

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
