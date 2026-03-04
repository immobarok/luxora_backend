import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  code!: string;
}
