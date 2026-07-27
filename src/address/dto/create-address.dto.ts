import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  /** Address type: 'SHIPPING' | 'BILLING' | 'BOTH' */
  @IsString()
  @IsIn(['SHIPPING', 'BILLING', 'BOTH'], {
    message: 'type must be SHIPPING, BILLING, or BOTH',
  })
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line1!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  /** If true, this address will be set as the default for its type */
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
