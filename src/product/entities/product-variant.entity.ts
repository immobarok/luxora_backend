export class ProductVariantOption {
  name: string;
  value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

interface ProductVariantOptionLike {
  name: string;
  value: string;
}

export class ProductVariantEntity {
  id!: string;
  productId!: string;
  sku!: string;
  options!: ProductVariantOption[];
  price!: number;
  salePrice!: number | null;
  stockStatus!: string;
  quantity!: number;
  reservedQuantity!: number;
  lowStockThreshold!: number;
  barcode!: string | null;
  upc!: string | null;
  mediaUrls!: string[];
  weight!: number | null;
  dimensions!: Record<string, number> | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<ProductVariantEntity>) {
    Object.assign(this, partial);
    if (partial.options) {
      this.options = (partial.options as ProductVariantOptionLike[]).map((o) =>
        o instanceof ProductVariantOption
          ? o
          : new ProductVariantOption(o.name, o.value),
      );
    }
  }

  get displayName(): string {
    return this.options.map((o) => o.value).join(' / ');
  }

  get isOnSale(): boolean {
    return this.salePrice !== null && this.salePrice < this.price;
  }

  get finalPrice(): number {
    return this.salePrice ?? this.price;
  }

  get availableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }
}
