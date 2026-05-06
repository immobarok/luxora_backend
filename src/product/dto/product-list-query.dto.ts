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

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(lowered)) return true;
    if (['false', '0', 'no'].includes(lowered)) return false;
  }
  return value;
};

export enum ProductSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PRICE = 'price',
  NAME = 'name',
  POPULARITY = 'popularity',
  RATING = 'rating',
  LATEST = 'latest',
  OLDEST = 'oldest',
  PRICE_LOW_TO_HIGH = 'price_low_to_high',
  PRICE_HIGH_TO_LOW = 'price_high_to_low',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

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
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy?: ProductSortBy = ProductSortBy.CREATED_AT;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
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
  @Transform(toBoolean)
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  isNewArrival?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  isBestSeller?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  isSale?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  trackInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  allowBackorder?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  isFreeShipping?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
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

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minRating?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxRating?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minSales?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxSales?: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsOptional()
  @Type(() => Date)
  createdFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  createdTo?: Date;

  @IsOptional()
  @Type(() => Date)
  publishedFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  publishedTo?: Date;
}

export class ProductListQueryDto extends ProductFilterDto {
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy?: ProductSortBy;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;

  @ValidateNested()
  @Type(() => ProductSortDto)
  @IsOptional()
  sort?: ProductSortDto;

  @ValidateNested()
  @Type(() => PaginationDto)
  @IsOptional()
  pagination?: PaginationDto = new PaginationDto();
}
