import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Length,
  IsBoolean,
} from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  slug!: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  description?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean = false;
}
