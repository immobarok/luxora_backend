// src/product/dto/product-list-query.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Gender, ProductStatus } from '@prisma/client';

export class PaginationDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class ProductSortDto {
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ProductFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @Matches(/^c[a-z0-9]{24}$/i, {
    each: true,
    message: 'each value in categoryIds must be a CUID',
  })
  @IsOptional()
  categoryIds?: string[];

  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i, {
    message: 'brandId must be a CUID',
  })
  @IsOptional()
  brandId?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  inStock?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;
}

export class ProductListQueryDto extends ProductFilterDto {
  @ValidateNested()
  @Type(() => ProductSortDto)
  @IsOptional()
  sort?: ProductSortDto;

  @ValidateNested()
  @Type(() => PaginationDto)
  @IsOptional()
  pagination?: PaginationDto = new PaginationDto();
}
