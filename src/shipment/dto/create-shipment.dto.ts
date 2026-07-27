import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsDateString, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ShipmentItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Type(() => Number)
  quantity!: number;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  carrier!: string;

  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;

  @IsString()
  @IsOptional()
  trackingUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items!: ShipmentItemDto[];

  @IsDateString()
  @IsOptional()
  estimatedDelivery?: string;
}
