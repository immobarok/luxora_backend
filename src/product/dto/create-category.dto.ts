// src/category/dto/create-category.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Length,
  IsInt,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
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
  @Length(0, 500)
  description?: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;
}
