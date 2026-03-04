// src/order/dto/update-order-status.dto.ts

import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { OrderStatus as PrismaOrderStatus } from '@prisma/client';

export { PrismaOrderStatus as OrderStatus };

export class UpdateOrderStatusDto {
  @IsEnum(PrismaOrderStatus)
  @IsNotEmpty()
  status!: PrismaOrderStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}
