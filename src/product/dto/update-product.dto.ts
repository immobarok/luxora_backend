import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { ProductStatus } from '@prisma/client';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  // Prevent create-time defaults from overriding existing values in PATCH.
  trackInventory?: boolean = undefined;
  allowBackorder?: boolean = undefined;
  isFreeShipping?: boolean = undefined;
  status?: ProductStatus = undefined;
  isFeatured?: boolean = undefined;
}
