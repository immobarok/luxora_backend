import { IsNotEmpty, IsString } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  cartId!: string;
}
