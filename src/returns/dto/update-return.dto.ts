import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateReturnStatusDto {
  @IsString()
  @IsOptional()
  status?: string; // e.g. APPROVED, REJECTED, REFUNDED

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsNumber()
  @IsOptional()
  refundAmount?: number;
}
