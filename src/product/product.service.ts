import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  Gender,
  MediaCategory,
  Prisma,
  ProductStatus,
  StockStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, CreateVariantDto } from './dto/create-product.dto';
import { ProductListQueryDto } from './dto/product-list-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_INCLUDE = {
  brand: true,
  categories: { include: { category: true } },
  media: { where: { isDeleted: false } },
  attributes: true,
  variants: true,
} satisfies Prisma.ProductInclude;

const STOREFRONT_VISIBLE_STATUSES = [
  ProductStatus.ACTIVE,
  ProductStatus.APPROVED,
];

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly cacheTtlSeconds = 300;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(adminId: string, dto: CreateProductDto) {
    this.logger.log(`Creating product: ${dto.name} by admin ${adminId}`);
    // Check constraints before generating any unique values
    if (dto.variants?.length) {
      await this.validateVariantSkus(dto.variants);
    }
    if (dto.brandId) {
      await this.validateBrand(dto.brandId);
    }
    if (dto.categoryIds?.length) {
      await this.validateCategories(dto.categoryIds);
    }
    if (dto.mediaIds?.length) {
      await this.validateMediaIds(dto.mediaIds, adminId);
    }

    const sku = await this.generateSku(dto.name);
    const slug = await this.generateUniqueSlug(dto.name);

    // Auto-generate variant SKUs if missing
    if (dto.variants) {
      dto.variants.forEach((variant) => {
        const normalizedOptions = this.normalizeVariantOptions(variant);
        if (!variant.sku) {
          variant.sku = this.generateVariantSku(sku, normalizedOptions);
        }
      });
      // Re-validate now that we have SKUs
      await this.validateVariantSkus(dto.variants);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: this.buildCreateInput(adminId, slug, sku, dto),
        include: PRODUCT_INCLUDE,
      });

      if (dto.mediaIds?.length) {
        await tx.media.updateMany({
          where: { id: { in: dto.mediaIds } },
          data: { productId: created.id },
        });
      }

      return created;
    });

    await this.invalidateProductCache(product.id, product.slug);
    return this.serializeProduct(product);
  }

  async findAll(query: ProductListQueryDto) {
    const cacheKey = `products:list:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) return cached;

    const { pagination, sort, ...filters } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderBy(sort);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products.map((p) => this.serializeProduct(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, result, this.cacheTtlSeconds);
    return result;
  }

  async findFeatured() {
    const cacheKey = 'products:featured';
    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        isFeatured: true,
        status: { in: STOREFRONT_VISIBLE_STATUSES },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: PRODUCT_INCLUDE,
    });

    const result = products.map((p) => this.serializeProduct(p));
    await this.cacheManager.set(cacheKey, result, this.cacheTtlSeconds);
    return result;
  }

  async findNewArrivals() {
    const cacheKey = 'products:new-arrivals';
    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        isNewArrival: true,
        status: { in: STOREFRONT_VISIBLE_STATUSES },
      },
      take: 10,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: PRODUCT_INCLUDE,
    });

    const result = products.map((p) => this.serializeProduct(p));
    await this.cacheManager.set(cacheKey, result, this.cacheTtlSeconds);
    return result;
  }

  async findById(id: string, includeDeleted = false) {
    const cacheKey = `product:${id}:${includeDeleted ? 'all' : 'active'}`;
    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        ...(includeDeleted
          ? {}
          : { status: { not: ProductStatus.DISCONTINUED } }),
      },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const result = this.serializeProduct(product);
    await this.cacheManager.set(cacheKey, result, this.cacheTtlSeconds);
    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `product:slug:${slug}`;
    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    const result = this.serializeProduct(product);
    await this.cacheManager.set(cacheKey, result, this.cacheTtlSeconds);
    return result;
  }

  async findRelatedById(id: string, limit = 8) {
    const base = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        gender: true,
        categories: { select: { categoryId: true } },
      },
    });

    if (!base) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return this.findRelated(
      base.id,
      base.brandId,
      base.gender,
      base.categories,
      limit,
    );
  }

  async findRelatedBySlug(slug: string, limit = 8) {
    const base = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        brandId: true,
        gender: true,
        categories: { select: { categoryId: true } },
      },
    });

    if (!base) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    return this.findRelated(
      base.id,
      base.brandId,
      base.gender,
      base.categories,
      limit,
    );
  }

  async update(id: string, adminId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const updateData: Prisma.ProductUpdateInput = {};
    const mediaIdsToAdd: string[] = [];
    const mediaIdsToRemove: string[] = [];
    let variantsToUpsert:
      | Array<{
          sku: string;
          options: Prisma.InputJsonValue;
          price: number;
          salePrice?: number;
          quantity: number;
          stockStatus: StockStatus;
          barcode?: string;
          upc?: string;
          mediaUrls: string[];
          weight?: number;
        }>
      | undefined;

    if (dto.name && dto.name !== existing.name) {
      updateData.name = dto.name;
      updateData.slug = await this.generateUniqueSlug(dto.name);
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.shortDescription !== undefined) {
      updateData.shortDescription = dto.shortDescription;
    }
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.basePrice !== undefined) updateData.basePrice = dto.basePrice;
    if (dto.compareAtPrice !== undefined) {
      updateData.compareAtPrice = dto.compareAtPrice;
    }
    if (dto.costPrice !== undefined) updateData.costPrice = dto.costPrice;
    if (dto.trackInventory !== undefined) {
      updateData.trackInventory = dto.trackInventory;
    }
    if (dto.allowBackorder !== undefined) {
      updateData.allowBackorder = dto.allowBackorder;
    }
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.dimensions !== undefined) {
      updateData.dimensions =
        dto.dimensions as unknown as Prisma.InputJsonValue;
    }
    if (dto.isFreeShipping !== undefined) {
      updateData.isFreeShipping = dto.isFreeShipping;
    }
    if (dto.metaTitle !== undefined) updateData.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) {
      updateData.metaDescription = dto.metaDescription;
    }
    if (dto.keywords !== undefined) updateData.keywords = dto.keywords;

    if (dto.isFeatured !== undefined) updateData.isFeatured = dto.isFeatured;

    if (dto.brandId !== undefined) {
      if (dto.brandId) {
        await this.validateBrand(dto.brandId);
      }
      updateData.brand = dto.brandId
        ? { connect: { id: dto.brandId } }
        : { disconnect: true };
    }

    if (dto.categoryIds !== undefined) {
      if (dto.categoryIds.length > 0) {
        await this.validateCategories(dto.categoryIds);
      }

      updateData.categories = {
        deleteMany: {},
        ...(dto.categoryIds.length > 0
          ? {
              create: dto.categoryIds.map((categoryId) => ({
                category: { connect: { id: categoryId } },
              })),
            }
          : {}),
      };
    }

    if (dto.attributes !== undefined) {
      updateData.attributes = {
        deleteMany: {},
        ...(dto.attributes.length > 0
          ? {
              create: dto.attributes.map((attribute) => ({
                name: attribute.name,
                value: attribute.value,
                displayType: attribute.displayType ?? 'text',
              })),
            }
          : {}),
      };
    }

    if (dto.variants !== undefined) {
      if (dto.variants.length > 0) {
        // Auto-generate variant SKUs if missing
        dto.variants.forEach((variant) => {
          const normalizedOptions = this.normalizeVariantOptions(variant);
          if (!variant.sku) {
            variant.sku = this.generateVariantSku(
              existing.sku,
              normalizedOptions,
            );
          }
        });

        await this.validateVariantSkus(dto.variants, id);
      }

      variantsToUpsert = dto.variants.map((variant) => {
        const normalizedOptions = this.normalizeVariantOptions(variant);
        return {
          sku: variant.sku!, // Safe assertion after auto-generation
          options: normalizedOptions as unknown as Prisma.InputJsonValue,
          price: variant.price,
          salePrice: variant.salePrice,
          quantity: variant.quantity,
          stockStatus: this.calculateStockStatus(variant.quantity),
          barcode: variant.barcode,
          upc: variant.upc,
          mediaUrls: variant.mediaUrls ?? [],
          weight: variant.weight,
        };
      });
    }

    if (dto.mediaIds) {
      await this.validateMediaIds(dto.mediaIds, adminId);
      const currentMediaIds = existing.media.map((media) => media.id);

      mediaIdsToAdd.push(
        ...dto.mediaIds.filter((mediaId) => !currentMediaIds.includes(mediaId)),
      );
      mediaIdsToRemove.push(
        ...currentMediaIds.filter(
          (mediaId) => !dto.mediaIds!.includes(mediaId),
        ),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: updateData,
        include: PRODUCT_INCLUDE,
      });

      if (variantsToUpsert !== undefined) {
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true, sku: true },
        });

        const existingBySku = new Map(
          existingVariants.map((variant) => [variant.sku, variant.id]),
        );
        const incomingSkus = new Set(variantsToUpsert.map((item) => item.sku));
        const skusToDeactivate = existingVariants
          .map((variant) => variant.sku)
          .filter((sku) => !incomingSkus.has(sku));

        if (skusToDeactivate.length > 0) {
          await tx.productVariant.updateMany({
            where: {
              productId: id,
              sku: { in: skusToDeactivate },
            },
            data: { isActive: false },
          });
        }

        for (const variant of variantsToUpsert) {
          const existingVariantId = existingBySku.get(variant.sku);

          if (existingVariantId) {
            await tx.productVariant.update({
              where: { id: existingVariantId },
              data: {
                options: variant.options,
                price: variant.price,
                salePrice: variant.salePrice,
                quantity: variant.quantity,
                stockStatus: variant.stockStatus,
                barcode: variant.barcode,
                upc: variant.upc,
                mediaUrls: variant.mediaUrls,
                weight: variant.weight,
                isActive: true,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                sku: variant.sku,
                options: variant.options,
                price: variant.price,
                salePrice: variant.salePrice,
                quantity: variant.quantity,
                stockStatus: variant.stockStatus,
                barcode: variant.barcode,
                upc: variant.upc,
                mediaUrls: variant.mediaUrls,
                weight: variant.weight,
                isActive: true,
              },
            });
          }
        }
      }

      if (mediaIdsToAdd.length > 0) {
        await tx.media.updateMany({
          where: { id: { in: mediaIdsToAdd } },
          data: { productId: id },
        });
      }

      if (mediaIdsToRemove.length > 0) {
        await tx.media.updateMany({
          where: { id: { in: mediaIdsToRemove } },
          data: { productId: null },
        });
      }

      return product;
    });

    await this.invalidateProductCache(id, updated.slug);
    return this.serializeProduct(updated);
  }

  async remove(id: string, _adminId: string, permanent = false): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    if (permanent) {
      await this.prisma.$transaction([
        this.prisma.media.updateMany({
          where: { productId: id },
          data: { productId: null },
        }),
        this.prisma.productCategory.deleteMany({ where: { productId: id } }),
        this.prisma.productAttribute.deleteMany({ where: { productId: id } }),
        this.prisma.productVariant.deleteMany({ where: { productId: id } }),
        this.prisma.product.delete({ where: { id } }),
      ]);
    } else {
      await this.prisma.product.update({
        where: { id },
        data: { status: ProductStatus.DISCONTINUED },
      });
    }

    await this.invalidateProductCache(id, product.slug);
  }

  async publish(id: string, adminId: string) {
    void adminId;
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
        isNewArrival: true,
      },
      include: PRODUCT_INCLUDE,
    });

    await this.invalidateProductCache(id, product.slug);
    return this.serializeProduct(product);
  }

  async unpublish(id: string, adminId: string) {
    void adminId;
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.DRAFT },
      include: PRODUCT_INCLUDE,
    });

    await this.invalidateProductCache(id, product.slug);
    return this.serializeProduct(product);
  }

  async updateStock(
    variantId: string,
    quantityDelta: number,
    reason: string,
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    const nextQuantity = Math.max(0, variant.quantity + quantityDelta);
    const stockStatus = this.calculateStockStatus(nextQuantity);

    await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: { quantity: nextQuantity, stockStatus },
      }),
      this.prisma.inventoryLog.create({
        data: {
          variantId,
          type: quantityDelta >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
          quantity: quantityDelta,
          reason,
          reference: 'Manual stock adjustment',
        },
      }),
    ]);
  }

  private async validateBrand(brandId: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID "${brandId}" not found`);
    }
  }

  private async validateCategories(categoryIds: string[]): Promise<void> {
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const foundIds = new Set(categories.map((c) => c.id));
    const missing = categoryIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Categories not found: ${missing.join(', ')}`,
      );
    }
  }

  private async ensureSkuUnique(sku: string): Promise<void> {
    const exists = await this.prisma.product.findUnique({ where: { sku } });
    if (exists) {
      throw new ConflictException(`SKU "${sku}" already exists`);
    }
  }

  private async validateVariantSkus(
    variants: { sku?: string }[],
    productId?: string,
  ): Promise<void> {
    const skuSet = new Set<string>();
    for (const variant of variants) {
      if (variant.sku) {
        if (skuSet.has(variant.sku)) {
          throw new BadRequestException(
            `Duplicate variant SKU "${variant.sku}"`,
          );
        }
        skuSet.add(variant.sku);
      }
    }

    const skusToCheck = variants
      .map((v) => v.sku)
      .filter((sku): sku is string => !!sku);

    if (skusToCheck.length > 0) {
      const existing = await this.prisma.productVariant.findMany({
        where: {
          sku: { in: skusToCheck },
          ...(productId ? { productId: { not: productId } } : {}),
        },
        select: { sku: true },
      });

      if (existing.length > 0) {
        throw new ConflictException(
          `Variant SKU already exists: ${existing.map((item) => item.sku).join(', ')}`,
        );
      }
    }
  }

  private async validateMediaIds(
    mediaIds: string[],
    userId: string,
  ): Promise<void> {
    const media = await this.prisma.media.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, category: true, uploaderId: true },
    });

    if (media.length !== mediaIds.length) {
      const found = new Set(media.map((item) => item.id));
      const missing = mediaIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Media not found: ${missing.join(', ')}`);
    }

    const nonImages = media.filter(
      (item) => item.category !== MediaCategory.IMAGE,
    );
    if (nonImages.length > 0) {
      throw new BadRequestException(
        'Only images are allowed for product media',
      );
    }

    const unauthorized = media.filter((item) => item.uploaderId !== userId);
    if (unauthorized.length > 0) {
      throw new ForbiddenException('Access denied to one or more media files');
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    let slug = base;
    let counter = 1;

    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter += 1;
    }

    return slug;
  }

  private async generateSku(name: string): Promise<string> {
    const prefix = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000); // 4 digit random
    let sku = `${prefix}-${random}`;
    let counter = 1;

    // Ensure uniqueness
    while (await this.prisma.product.findUnique({ where: { sku } })) {
      sku = `${prefix}-${random}-${counter}`;
      counter++;
    }

    return sku;
  }

  private generateVariantSku(
    productSku: string,
    options: { value: string }[],
  ): string {
    const parts = [productSku];
    for (const opt of options) {
      const val = opt.value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .substring(0, 3);
      parts.push(val || 'OPT');
    }
    // Add randomness to ensure uniqueness if options are identical/empty
    if (options.length === 0) {
      parts.push(Math.floor(1000 + Math.random() * 9000).toString());
    }
    return parts.join('-');
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private buildCreateInput(
    adminId: string,
    slug: string,
    sku: string,
    dto: CreateProductDto,
  ): Prisma.ProductCreateInput {
    return {
      slug,
      sku: sku,
      name: dto.name,
      description: dto.description,
      shortDescription: dto.shortDescription,
      gender: dto.gender,
      status: dto.status ?? ProductStatus.DRAFT,
      basePrice: dto.basePrice,
      compareAtPrice: dto.compareAtPrice,
      costPrice: dto.costPrice,
      trackInventory: dto.trackInventory ?? true,
      allowBackorder: dto.allowBackorder ?? false,
      weight: dto.weight,
      dimensions: dto.dimensions as unknown as Prisma.InputJsonValue,
      isFreeShipping: dto.isFreeShipping ?? false,
      metaTitle: dto.metaTitle ?? dto.name,
      metaDescription: dto.metaDescription ?? dto.shortDescription,
      keywords: dto.keywords ?? [],
      isFeatured: dto.isFeatured ?? false,
      isNewArrival: true,
      isBestSeller: false,
      isSale: dto.compareAtPrice ? dto.basePrice < dto.compareAtPrice : false,
      avgRating: 0,
      reviewCount: 0,
      totalSales: 0,
      publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : null,
      creator: { connect: { id: adminId } },
      brand: dto.brandId ? { connect: { id: dto.brandId } } : undefined,
      categories: dto.categoryIds
        ? {
            create: dto.categoryIds.map((categoryId) => ({
              category: { connect: { id: categoryId } },
            })),
          }
        : undefined,
      attributes: dto.attributes
        ? {
            create: dto.attributes.map((attribute) => ({
              name: attribute.name,
              value: attribute.value,
              displayType: attribute.displayType ?? 'text',
            })),
          }
        : undefined,
      variants: dto.variants
        ? {
            create: dto.variants.map((variant) => {
              const normalizedOptions = this.normalizeVariantOptions(variant);
              return {
                sku: variant.sku!,
                options: normalizedOptions as unknown as Prisma.InputJsonValue,
                price: variant.price,
                salePrice: variant.salePrice,
                quantity: variant.quantity,
                stockStatus: this.calculateStockStatus(variant.quantity),
                barcode: variant.barcode,
                upc: variant.upc,
                mediaUrls: variant.mediaUrls ?? [],
                weight: variant.weight,
              };
            }),
          }
        : undefined,
    };
  }

  private normalizeVariantOptions(
    variant: Pick<CreateVariantDto, 'options' | 'size'>,
  ): Array<{ name: string; value: string }> {
    const options = [...(variant.options ?? [])];

    if (
      variant.size &&
      !options.some((opt) => opt.name.toLowerCase() === 'size')
    ) {
      options.push({ name: 'Size', value: variant.size });
    }

    if (options.length === 0) {
      throw new BadRequestException(
        'Each variant must include at least one option or a size',
      );
    }

    return options;
  }

  private async findRelated(
    productId: string,
    brandId: string | null,
    gender: Gender,
    categories: Array<{ categoryId: string }>,
    limit: number,
  ) {
    const safeLimit = Math.min(Math.max(limit || 8, 1), 24);
    const categoryIds = categories.map((row) => row.categoryId);

    const orFilters: Prisma.ProductWhereInput[] = [{ gender }];
    if (brandId) {
      orFilters.push({ brandId });
    }
    if (categoryIds.length > 0) {
      orFilters.push({
        categories: {
          some: {
            categoryId: { in: categoryIds },
          },
        },
      });
    }

    const related = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        status: { in: STOREFRONT_VISIBLE_STATUSES },
        OR: orFilters,
      },
      take: safeLimit,
      orderBy: [
        { isFeatured: 'desc' },
        { totalSales: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: PRODUCT_INCLUDE,
    });

    if (related.length < safeLimit) {
      const relatedIds = new Set(related.map((item) => item.id));
      const fallback = await this.prisma.product.findMany({
        where: {
          id: {
            not: productId,
            notIn: Array.from(relatedIds),
          },
          status: { in: STOREFRONT_VISIBLE_STATUSES },
        },
        take: safeLimit - related.length,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: PRODUCT_INCLUDE,
      });

      related.push(...fallback);
    }

    return related.map((item) => this.serializeProduct(item));
  }

  private buildWhereClause(
    filters: ProductListQueryDto,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      status: { not: ProductStatus.DISCONTINUED },
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.gender) where.gender = filters.gender;
    if (filters.status) where.status = filters.status;
    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

    if (filters.inStock !== undefined) {
      where.variants = {
        some: {
          stockStatus: filters.inStock
            ? { in: [StockStatus.IN_STOCK, StockStatus.LOW_STOCK] }
            : StockStatus.OUT_OF_STOCK,
        },
      };
    }

    if (filters.categoryIds?.length) {
      where.categories = {
        some: {
          categoryId: { in: filters.categoryIds },
        },
      };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.basePrice = {};
      if (filters.minPrice !== undefined)
        where.basePrice.gte = filters.minPrice;
      if (filters.maxPrice !== undefined)
        where.basePrice.lte = filters.maxPrice;
    }

    return where;
  }

  private buildOrderBy(
    sort?: ProductListQueryDto['sort'],
  ): Prisma.ProductOrderByWithRelationInput {
    const sortBy = sort?.sortBy ?? 'createdAt';
    const sortOrder = sort?.sortOrder ?? 'desc';

    const map: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      createdAt: { createdAt: sortOrder },
      updatedAt: { updatedAt: sortOrder },
      price: { basePrice: sortOrder },
      name: { name: sortOrder },
      popularity: { totalSales: sortOrder },
      rating: { avgRating: sortOrder },
    };

    return map[sortBy] ?? map.createdAt;
  }

  private calculateStockStatus(quantity: number): StockStatus {
    if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
    if (quantity < 10) return StockStatus.LOW_STOCK;
    return StockStatus.IN_STOCK;
  }

  private async invalidateProductCache(
    id?: string,
    slug?: string,
  ): Promise<void> {
    const keys: string[] = ['products:featured', 'products:new-arrivals'];
    if (id) keys.push(`product:${id}:active`, `product:${id}:all`);
    if (slug) keys.push(`product:slug:${slug}`);

    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }

  private serializeProduct(
    value: Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>,
  ) {
    const product = this.deepConvert(value) as Record<string, unknown>;

    const categories = Array.isArray(product.categories)
      ? product.categories.map((item) => {
          const row = item as Record<string, unknown>;
          const category = (row.category ?? {}) as Record<string, unknown>;
          return {
            id: category.id,
            slug: category.slug,
            name: category.name,
            imageUrl: category.imageUrl,
          };
        })
      : [];

    const media = Array.isArray(product.media)
      ? product.media.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: row.id,
            url: row.url,
            thumbnailUrl: row.thumbnailUrl,
            alt: row.alt,
          };
        })
      : [];

    const attributes = Array.isArray(product.attributes)
      ? product.attributes.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: row.id,
            name: row.name,
            value: row.value,
            displayType: row.displayType,
          };
        })
      : [];

    const variants = Array.isArray(product.variants)
      ? product.variants.map((item) => {
          const row = item as Record<string, unknown>;
          const options = Array.isArray(row.options)
            ? (row.options as Array<{ name?: string; value?: string }>)
            : [];
          const sizeOption = options.find(
            (opt) => (opt.name ?? '').toLowerCase() === 'size',
          );
          return {
            id: row.id,
            sku: row.sku,
            size: sizeOption?.value ?? null,
            options,
            price: row.price,
            salePrice: row.salePrice,
            stockStatus: row.stockStatus,
            quantity: row.quantity,
            weight: row.weight,
            isActive: row.isActive,
          };
        })
      : [];

    const brand = product.brand as Record<string, unknown> | null;

    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      gender: product.gender,
      status: product.status,
      basePrice: product.basePrice,
      compareAtPrice: product.compareAtPrice,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      isSale: product.isSale,
      avgRating: product.avgRating,
      reviewCount: product.reviewCount,
      totalSales: product.totalSales,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      brand: brand
        ? {
            id: brand.id,
            slug: brand.slug,
            name: brand.name,
            logoUrl: brand.logoUrl,
          }
        : null,
      categories,
      media,
      attributes,
      variants,
    };
  }

  private deepConvert(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.deepConvert(item));
    }
    if (typeof value === 'object') {
      const decimalCandidate = value as { toNumber?: () => number };
      if (typeof decimalCandidate.toNumber === 'function') {
        return decimalCandidate.toNumber();
      }

      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        result[key] = this.deepConvert(item);
      }
      return result;
    }
    return value;
  }
}
