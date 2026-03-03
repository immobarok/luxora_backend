export class ProductAttributeEntity {
  id!: string;
  productId!: string;
  name!: string;
  value!: string;
  displayType!: string;
  createdAt!: Date;

  constructor(partial: Partial<ProductAttributeEntity>) {
    Object.assign(this, partial);
  }
}
