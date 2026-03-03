export class ProductMediaEntity {
  id!: string;
  productId!: string;
  url!: string;
  type!: string;
  position!: number;
  altText!: string | null;
  isPrimary!: boolean;
  createdAt!: Date;

  constructor(partial: Partial<ProductMediaEntity>) {
    Object.assign(this, partial);
  }
}
