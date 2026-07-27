import { IsNotEmpty, IsString, IsArray, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ReturnReason } from '@prisma/client';

export class ReturnItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsArray()
  @IsNotEmpty()
  items!: ReturnItemDto[];

  @IsEnum(ReturnReason)
  @IsNotEmpty()
  primaryReason!: ReturnReason;

  @IsString()
  @IsOptional()
  customerComment?: string;
}
