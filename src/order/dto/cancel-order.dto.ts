// src/order/dto/cancel-order.dto.ts

import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  reason!: string;
}
