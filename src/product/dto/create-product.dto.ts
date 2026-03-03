import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  IsBoolean,
  Min,
  ArrayMinSize,
  Length,
  Matches,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, ProductStatus } from '@prisma/client';

export class VariantOptionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  sku!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options!: VariantOptionDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  salePrice?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  upc?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaUrls?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;
}

export class CreateAttributeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsOptional()
  displayType?: string = 'text';
}

export class CreateMediaDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  type?: string = 'image';

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number = 0;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}

export class DimensionsDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  length?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  width?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  height?: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 50000)
  description!: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  shortDescription?: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9-_]+$/)
  sku!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  basePrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  compareAtPrice?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  costPrice?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mediaIds?: string[];

  @IsUUID()
  @IsOptional()
  brandId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  @IsOptional()
  media?: CreateMediaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttributeDto)
  @IsOptional()
  attributes?: CreateAttributeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean = true;

  @IsBoolean()
  @IsOptional()
  allowBackorder?: boolean = false;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @ValidateNested()
  @Type(() => DimensionsDto)
  @IsOptional()
  dimensions?: DimensionsDto;

  @IsBoolean()
  @IsOptional()
  isFreeShipping?: boolean = false;

  @IsString()
  @IsOptional()
  @Length(0, 70)
  metaTitle?: string;

  @IsString()
  @IsOptional()
  @Length(0, 320)
  metaDescription?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus = ProductStatus.DRAFT;
}
