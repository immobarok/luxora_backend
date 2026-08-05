import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestimonialDto {
  @ApiProperty({ description: 'The quote text of the testimonial' })
  @IsString()
  @IsNotEmpty()
  quote: string;

  @ApiProperty({ description: 'Name of the client' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Role or designation of the client' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'URL of the client avatar image' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: 'Whether the testimonial is currently active and visible', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
