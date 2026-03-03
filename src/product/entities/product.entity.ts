import { BaseEntity } from './base.entity';
import { BrandEntity } from './brand.entity';
import { ProductCategoryEntity } from './product-category.entity';
import { ProductMediaEntity } from './product-media.entity';
import { ProductAttributeEntity } from './product-attribute.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { Gender, ProductStatus } from '@prisma/client';

export class ProductEntity extends BaseEntity {
  slug!: string;
  sku!: string;
  name!: string;
  description!: string;
  shortDescription!: string | null;
  createdBy!: string;
  brandId!: string | null;
  gender!: Gender;
  status!: ProductStatus;

  // Pricing
  basePrice!: number;
  compareAtPrice!: number | null;
  costPrice!: number | null;

  // Inventory
  trackInventory!: boolean;
  allowBackorder!: boolean;

  // Shipping
  weight!: number | null;
  dimensions!: Record<string, number> | null;
  isFreeShipping!: boolean;

  // SEO
  metaTitle!: string | null;
  metaDescription!: string | null;
  keywords!: string[];

  // Flags
  isFeatured!: boolean;
  isNewArrival!: boolean;
  isBestSeller!: boolean;
  isSale!: boolean;

  // Analytics
  avgRating!: number;
  reviewCount!: number;
  totalSales!: number;

  // Publishing
  publishedAt!: Date | null;

  // Relations
  brand!: BrandEntity | null;
  categories!: ProductCategoryEntity[];
  media!: ProductMediaEntity[];
  attributes!: ProductAttributeEntity[];
  variants!: ProductVariantEntity[];

  constructor(partial: Partial<ProductEntity>) {
    super(partial);
    Object.assign(this, partial);

    // Transform nested entities
    if (partial.brand) {
      this.brand =
        partial.brand instanceof BrandEntity
          ? partial.brand
          : new BrandEntity(partial.brand);
    }

    this.categories = (partial.categories || []).map((c) =>
      c instanceof ProductCategoryEntity ? c : new ProductCategoryEntity(c),
    );

    this.media = (partial.media || []).map((m) =>
      m instanceof ProductMediaEntity ? m : new ProductMediaEntity(m),
    );

    this.attributes = (partial.attributes || []).map((a) =>
      a instanceof ProductAttributeEntity ? a : new ProductAttributeEntity(a),
    );

    this.variants = (partial.variants || []).map((v) =>
      v instanceof ProductVariantEntity ? v : new ProductVariantEntity(v),
    );
  }

  // ============================================================
  // Business Logic Methods
  // ============================================================

  get isPublished(): boolean {
    return this.status === ProductStatus.ACTIVE && this.publishedAt !== null;
  }

  get isInStock(): boolean {
    if (!this.trackInventory) return true;
    if (this.variants.length > 0) {
      return this.variants.some(
        (v) => v.stockStatus === 'IN_STOCK' || v.stockStatus === 'LOW_STOCK',
      );
    }
    return false;
  }

  get displayPrice(): number {
    const lowestVariant =
      this.variants.length > 0
        ? Math.min(...this.variants.map((v) => v.finalPrice))
        : this.basePrice;
    return lowestVariant;
  }

  get priceRange(): { min: number; max: number } | null {
    if (this.variants.length === 0) return null;
    const prices = this.variants.map((v) => v.finalPrice);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }

  get primaryImage(): ProductMediaEntity | null {
    return this.media.find((m) => m.isPrimary) || this.media[0] || null;
  }

  get discountPercentage(): number | null {
    if (!this.compareAtPrice || this.compareAtPrice <= this.basePrice)
      return null;
    return Math.round(
      ((this.compareAtPrice - this.displayPrice) / this.compareAtPrice) * 100,
    );
  }

  calculateMargin(): number | null {
    if (!this.costPrice) return null;
    return ((this.basePrice - this.costPrice) / this.basePrice) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      slug: this.slug,
      sku: this.sku,
      name: this.name,
      description: this.description,
      shortDescription: this.shortDescription,
      gender: this.gender,
      status: this.status,
      pricing: {
        basePrice: this.basePrice,
        compareAtPrice: this.compareAtPrice,
        displayPrice: this.displayPrice,
        discountPercentage: this.discountPercentage,
        priceRange: this.priceRange,
      },
      inventory: {
        trackInventory: this.trackInventory,
        allowBackorder: this.allowBackorder,
        isInStock: this.isInStock,
      },
      media: this.media,
      attributes: this.attributes,
      variants: this.variants,
      brand: this.brand,
      categories: this.categories,
      flags: {
        isFeatured: this.isFeatured,
        isNewArrival: this.isNewArrival,
        isBestSeller: this.isBestSeller,
        isSale: this.isSale,
      },
      analytics: {
        avgRating: this.avgRating,
        reviewCount: this.reviewCount,
        totalSales: this.totalSales,
      },
      seo: {
        metaTitle: this.metaTitle,
        metaDescription: this.metaDescription,
        keywords: this.keywords,
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    };
  }
}
