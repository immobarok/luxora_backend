import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodType } from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import { AddressInputDto } from './address.dto';

export { PaymentMethodType as PaymentMethod };

export class CheckoutDto {
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined,
  )
  @IsUUID()
  @IsOptional()
  shippingAddressId?: string;

  @ValidateNested()
  @Type(() => AddressInputDto)
  @IsOptional()
  shippingAddress?: AddressInputDto;

  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined,
  )
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
  @IsOptional()
  paymentToken?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
}
