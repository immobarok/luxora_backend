import { IsString, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressInputDto } from './address.dto';

export class CreateOrderDto {
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

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  giftMessage?: string;
}
