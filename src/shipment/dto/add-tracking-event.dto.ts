import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ShippingStatus } from '@prisma/client';

export class AddTrackingEventDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(ShippingStatus)
  @IsOptional()
  updateShipmentStatus?: ShippingStatus;
}
