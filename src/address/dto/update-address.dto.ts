import { PartialType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';

/** All fields are optional when updating an address */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
