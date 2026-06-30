import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class AboutValueDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class AboutStatDto {
  @IsString()
  value: string;

  @IsString()
  label: string;
}

export class UpdateAboutDto {
  @IsString()
  @IsOptional()
  heroTitle?: string;

  @IsString()
  @IsOptional()
  heroSubtitle?: string;

  @IsString()
  @IsOptional()
  heroImage?: string;

  @IsString()
  @IsOptional()
  missionTitle?: string;

  @IsString()
  @IsOptional()
  missionDescription?: string;

  @IsString()
  @IsOptional()
  missionImage?: string;

  @IsString()
  @IsOptional()
  visionTitle?: string;

  @IsString()
  @IsOptional()
  visionDescription?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AboutValueDto)
  @IsOptional()
  values?: AboutValueDto[];

  @IsString()
  @IsOptional()
  studioTitle?: string;

  @IsString()
  @IsOptional()
  studioDescription?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studioImages?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AboutStatDto)
  @IsOptional()
  stats?: AboutStatDto[];

  @IsString()
  @IsOptional()
  ctaTitle?: string;

  @IsString()
  @IsOptional()
  ctaSubtitle?: string;

  @IsString()
  @IsOptional()
  ctaButtonText?: string;

  @IsString()
  @IsOptional()
  ctaButtonLink?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}
