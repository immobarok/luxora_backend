export class ProductCategoryEntity {
  productId!: string;
  categoryId!: string;
  categoryName?: string;
  createdAt!: Date;

  constructor(partial: Partial<ProductCategoryEntity>) {
    Object.assign(this, partial);
  }
}
