import { IsString, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AddressInputDto } from './address.dto';

export class CreateOrderDto {
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

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  giftMessage?: string;
}
