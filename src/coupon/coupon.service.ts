import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

type CartCouponContext = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: {
                categories: {
                  select: {
                    categoryId: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async createCoupon(adminId: string, dto: CreateCouponDto): Promise<Coupon> {
    this.validateDateRange(dto.startsAt, dto.expiresAt);

    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        type: dto.type,
        value: dto.value,
        minPurchase: dto.minPurchase,
        maxDiscount: dto.maxDiscount,
        appliesTo: (dto.appliesTo || 'ALL').toUpperCase(),
        targetIds: dto.targetIds ?? [],
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        newCustomersOnly: dto.newCustomersOnly ?? false,
        requiresLogin: dto.requiresLogin ?? true,
        isActive: dto.isActive ?? true,
        createdBy: adminId,
      },
    });
  }

  async updateCoupon(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const startsAt = dto.startsAt ?? existing.startsAt.toISOString();
    const expiresAt =
      dto.expiresAt === undefined
        ? existing.expiresAt?.toISOString()
        : dto.expiresAt;
    this.validateDateRange(startsAt, expiresAt);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        description: dto.description,
        type: dto.type,
        value: dto.value,
        minPurchase: dto.minPurchase,
        maxDiscount: dto.maxDiscount,
        appliesTo: dto.appliesTo?.toUpperCase(),
        targetIds: dto.targetIds,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt:
          dto.expiresAt === undefined
            ? undefined
            : dto.expiresAt
              ? new Date(dto.expiresAt)
              : null,
        newCustomersOnly: dto.newCustomersOnly,
        requiresLogin: dto.requiresLogin,
        isActive: dto.isActive,
      },
    });
  }

  async toggleCoupon(id: string, isActive: boolean): Promise<Coupon> {
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive },
    });
  }

  async listCoupons(): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async calculateDiscountForCart(
    cartId: string,
    rawCode: string,
    userId?: string,
  ): Promise<{ coupon: Coupon; discountAmount: number }> {
    const code = rawCode.trim().toUpperCase();
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    categories: { select: { categoryId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await this.assertCouponValid(coupon, cart, userId);

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.totalPrice.toNumber(),
      0,
    );
    const eligibleSubtotal = this.getEligibleSubtotal(cart, coupon);

    if (eligibleSubtotal <= 0) {
      throw new BadRequestException('Coupon is not applicable for cart items');
    }

    let discountAmount = 0;

    if (coupon.type === DiscountType.PERCENTAGE) {
      discountAmount = eligibleSubtotal * (coupon.value.toNumber() / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(
          discountAmount,
          coupon.maxDiscount.toNumber(),
        );
      }
    } else if (coupon.type === DiscountType.FIXED_AMOUNT) {
      discountAmount = Math.min(coupon.value.toNumber(), eligibleSubtotal);
    } else if (coupon.type === DiscountType.FREE_SHIPPING) {
      discountAmount = cart.shippingTotal.toNumber();
    } else {
      throw new BadRequestException(
        `Coupon type ${coupon.type} is not supported yet`,
      );
    }

    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    return { coupon, discountAmount };
  }

  private validateDateRange(startsAt: string, expiresAt?: string): void {
    if (!expiresAt) return;
    if (new Date(expiresAt) <= new Date(startsAt)) {
      throw new BadRequestException('expiresAt must be later than startsAt');
    }
  }

  private async assertCouponValid(
    coupon: Coupon,
    cart: CartCouponContext,
    userId?: string,
  ): Promise<void> {
    if (!coupon.isActive) throw new BadRequestException('Coupon is inactive');

    const now = new Date();
    if (coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.totalPrice.toNumber(),
      0,
    );

    if (coupon.minPurchase && subtotal < coupon.minPurchase.toNumber()) {
      throw new BadRequestException(
        `Minimum purchase is ${coupon.minPurchase.toNumber()}`,
      );
    }

    if (coupon.requiresLogin && !userId) {
      throw new BadRequestException('Coupon requires login');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.newCustomersOnly) {
      if (!userId) {
        throw new BadRequestException('Coupon is for new customers only');
      }
      const orderCount = await this.prisma.order.count({ where: { userId } });
      if (orderCount > 0) {
        throw new BadRequestException('Coupon is for new customers only');
      }
    }

    if (coupon.perUserLimit && userId) {
      const usedByUser = await this.prisma.order.count({
        where: { userId, couponCode: coupon.code },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('Per-user coupon limit reached');
      }
    }
  }

  private getEligibleSubtotal(cart: CartCouponContext, coupon: Coupon): number {
    const appliesTo = (coupon.appliesTo || 'ALL').toUpperCase();
    const targetIds = new Set(coupon.targetIds);

    if (appliesTo === 'ALL') {
      return cart.items.reduce(
        (sum, item) => sum + item.totalPrice.toNumber(),
        0,
      );
    }

    if (targetIds.size === 0) return 0;

    if (appliesTo === 'PRODUCT') {
      return cart.items
        .filter((item) => targetIds.has(item.variant.product.id))
        .reduce((sum, item) => sum + item.totalPrice.toNumber(), 0);
    }

    if (appliesTo === 'BRAND') {
      return cart.items
        .filter((item) => {
          const brandId = item.variant.product.brandId;
          return typeof brandId === 'string' && targetIds.has(brandId);
        })
        .reduce((sum, item) => sum + item.totalPrice.toNumber(), 0);
    }

    if (appliesTo === 'CATEGORY') {
      return cart.items
        .filter((item) =>
          item.variant.product.categories.some((c) =>
            targetIds.has(c.categoryId),
          ),
        )
        .reduce((sum, item) => sum + item.totalPrice.toNumber(), 0);
    }

    return 0;
  }
}
