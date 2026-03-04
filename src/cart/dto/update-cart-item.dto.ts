import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  quantity!: number;
}
