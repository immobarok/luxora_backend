import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AddToCartDto, UpdateCartItemDto } from './dto';
import {
  CartEntity,
  CartItemEntity,
  CartSummaryEntity,
  CartSettingsInfo,
} from './entities/cart.entity';
import { CartSettingsService } from './cart-settings.service';

const cartWithItemsInclude = Prisma.validator<Prisma.CartInclude>()({
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: { media: { take: 1 } },
          },
        },
      },
    },
  },
});

type CartWithItems = Prisma.CartGetPayload<{
  include: typeof cartWithItemsInclude;
}>;
type ProductVariantWithProduct = Prisma.ProductVariantGetPayload<{
  include: { product: true };
}>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: CartSettingsService,
  ) {}

  private getGuestUserId(sessionId: string): string {
    return `guest:${sessionId}`;
  }

  // Get or create cart for user
  async getOrCreateCart(userId: string): Promise<CartWithItems> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: cartWithItemsInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId, currency: 'USD' },
        include: cartWithItemsInclude,
      });
    }

    return cart;
  }

  // Get or create guest cart
  async getOrCreateGuestCart(sessionId: string): Promise<CartWithItems> {
    const guestUserId = this.getGuestUserId(sessionId);
    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: cartWithItemsInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId: guestUserId,
          sessionId,
          currency: 'USD',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        include: cartWithItemsInclude,
      });
    }

    return cart;
  }

  // Add to cart (authenticated)
  async addToCart(userId: string, dto: AddToCartDto): Promise<CartEntity> {
    const { variantId, quantity } = dto;

    const variant = await this.validateVariant(variantId, quantity);
    const cart = await this.getOrCreateCart(userId);

    const existingItem = cart.items.find(
      (item) => item.variantId === variantId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      await this.updateCartItemQuantity(existingItem.id, newQuantity, variant);
    } else {
      await this.createCartItem(cart.id, variant, quantity);
    }

    await this.recalculateCart(cart.id);
    return this.getCartResponse(cart.id);
  }

  // Add to guest cart
  async addToGuestCart(
    sessionId: string,
    dto: AddToCartDto,
  ): Promise<CartEntity> {
    const { variantId, quantity } = dto;

    const variant = await this.validateVariant(variantId, quantity);
    const cart = await this.getOrCreateGuestCart(sessionId);

    const existingItem = cart.items.find(
      (item) => item.variantId === variantId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      await this.updateCartItemQuantity(existingItem.id, newQuantity, variant);
    } else {
      await this.createCartItem(cart.id, variant, quantity);
    }

    await this.recalculateCart(cart.id);
    return this.getCartResponse(cart.id);
  }

  // Update cart item
  async updateCartItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const { quantity } = dto;

    if (quantity < 0)
      throw new BadRequestException('Quantity cannot be negative');
    if (quantity === 0) return this.removeCartItem(userId, itemId);

    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { variant: true, cart: true },
    });

    if (!cartItem) throw new NotFoundException('Cart item not found');

    await this.validateVariant(cartItem.variantId, quantity);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        totalPrice: new Prisma.Decimal(cartItem.unitPrice).mul(quantity),
      },
    });

    await this.recalculateCart(cartItem.cart.id);
    return this.getCartResponse(cartItem.cart.id);
  }

  // Remove cart item
  async removeCartItem(userId: string, itemId: string): Promise<CartEntity> {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { cart: true },
    });

    if (!cartItem) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    await this.recalculateCart(cartItem.cart.id);

    return this.getCartResponse(cartItem.cart.id);
  }

  // Get cart
  async getCart(userId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { include: { media: { take: 1 } } },
              },
            },
          },
        },
      },
    });

    if (!cart) return this.getEmptyCartResponse(userId);

    return this.getCartResponse(cart.id);
  }

  // Get guest cart
  async getGuestCart(sessionId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { include: { media: { take: 1 } } },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        id: '',
        userId: this.getGuestUserId(sessionId),
        currency: 'USD',
        items: [],
        summary: {
          itemCount: 0,
          subtotal: 0,
          discountTotal: 0,
          taxTotal: 0,
          shippingTotal: 0,
          grandTotal: 0,
        },
      };
    }

    return this.getCartResponse(cart.id);
  }

  // Clear cart
  async clearCart(userId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.recalculateCart(cart.id);
    }

    return this.getCart(userId);
  }

  // Merge guest cart to user cart
  async mergeGuestCartToUser(
    sessionId: string,
    userId: string,
  ): Promise<CartEntity> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId);
    }

    const userCart = await this.getOrCreateCart(userId);

    for (const guestItem of guestCart.items) {
      const existingItem = userCart.items.find(
        (item) => item.variantId === guestItem.variantId,
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + guestItem.quantity;
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            totalPrice: new Prisma.Decimal(guestItem.unitPrice).mul(
              newQuantity,
            ),
          },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: guestItem.variantId,
            quantity: guestItem.quantity,
            unitPrice: guestItem.unitPrice,
            totalPrice: guestItem.totalPrice,
          },
        });
      }
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } });
    await this.recalculateCart(userCart.id);

    return this.getCartResponse(userCart.id);
  }

  // Validate variant
  private async validateVariant(
    variantId: string,
    requestedQuantity: number,
  ): Promise<ProductVariantWithProduct> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) throw new NotFoundException('Product variant not found');
    if (!variant.isActive)
      throw new BadRequestException('Product variant not available');
    if (variant.stockStatus === 'OUT_OF_STOCK')
      throw new BadRequestException('Product out of stock');
    if (variant.quantity < requestedQuantity) {
      throw new BadRequestException(
        `Only ${variant.quantity} available, requested ${requestedQuantity}`,
      );
    }

    return variant;
  }

  // Create cart item
  private async createCartItem(
    cartId: string,
    variant: ProductVariantWithProduct,
    quantity: number,
  ): Promise<void> {
    const unitPrice = variant.salePrice || variant.price;
    const totalPrice = new Prisma.Decimal(unitPrice).mul(quantity);

    await this.prisma.cartItem.create({
      data: {
        cartId,
        variantId: variant.id,
        quantity,
        unitPrice,
        totalPrice,
      },
    });
  }

  // Update cart item quantity
  private async updateCartItemQuantity(
    itemId: string,
    newQuantity: number,
    variant: ProductVariantWithProduct,
  ): Promise<void> {
    const unitPrice = variant.salePrice || variant.price;
    const totalPrice = new Prisma.Decimal(unitPrice).mul(newQuantity);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: newQuantity, totalPrice },
    });
  }

  // Recalculate cart totals
  private async recalculateCart(cartId: string): Promise<void> {
    const items = await this.prisma.cartItem.findMany({ where: { cartId } });
    const subtotal = items.reduce(
      (sum, item) => sum + item.totalPrice.toNumber(),
      0,
    );

    const settings = await this.settingsService.getSettings();
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId } });

    let discountTotal = 0;
    if (cart?.couponDiscount) discountTotal = cart.couponDiscount.toNumber();

    const taxTotal = subtotal * settings.TAX_RATE;
    const shippingTotal =
      subtotal >= settings.FREE_SHIPPING_THRESHOLD ? 0 : settings.SHIPPING_COST;
    const grandTotal = subtotal - discountTotal + taxTotal + shippingTotal;

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { subtotal, discountTotal, taxTotal, shippingTotal, grandTotal },
    });
  }

  // Get cart response
  private async getCartResponse(cartId: string): Promise<CartEntity> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: cartWithItemsInclude,
    });

    if (!cart) throw new NotFoundException('Cart not found');

    const settings = await this.settingsService.getSettings();

    const items: CartItemEntity[] = cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productId: item.variant.product.id,
      productName: item.variant.product.name,
      variantName: this.formatVariantName(item.variant.options),
      sku: item.variant.sku,
      imageUrl: item.variant.product.media[0]?.url || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      totalPrice: item.totalPrice.toNumber(),
      stockAvailable: item.variant.quantity,
      maxQuantity: Math.min(item.variant.quantity, 10),
    }));

    const summary: CartSummaryEntity = {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.subtotal.toNumber(),
      discountTotal: cart.discountTotal.toNumber(),
      taxTotal: cart.taxTotal.toNumber(),
      shippingTotal: cart.shippingTotal.toNumber(),
      grandTotal: cart.grandTotal.toNumber(),
    };

    const settingsInfo: CartSettingsInfo = {
      taxRate: settings.TAX_RATE,
      taxRatePercent: `${(settings.TAX_RATE * 100).toFixed(0)}%`,
      freeShippingThreshold: settings.FREE_SHIPPING_THRESHOLD,
      shippingCost: settings.SHIPPING_COST,
      isFreeShipping: summary.subtotal >= settings.FREE_SHIPPING_THRESHOLD,
    };

    return {
      id: cart.id,
      userId: cart.userId,
      currency: cart.currency,
      items,
      summary,
      settings: settingsInfo,
    };
  }

  // Format variant name
  private formatVariantName(options: Prisma.JsonValue): string {
    if (Array.isArray(options)) {
      const formatted = options
        .map((option) => {
          if (
            option &&
            typeof option === 'object' &&
            'name' in option &&
            'value' in option
          ) {
            const name = option.name;
            const value = option.value;
            if (typeof name === 'string' && typeof value === 'string') {
              return `${name}: ${value}`;
            }
          }
          return null;
        })
        .filter((value): value is string => value !== null);
      return formatted.join(', ');
    }

    if (options && typeof options === 'object') {
      return Object.entries(options)
        .map(([name, value]) => {
          const valueText =
            value === null || typeof value === 'string'
              ? `${value}`
              : typeof value === 'number' || typeof value === 'boolean'
                ? value.toString()
                : JSON.stringify(value);
          return `${name}: ${valueText}`;
        })
        .join(', ');
    }

    return '';
  }

  // Empty cart response
  private getEmptyCartResponse(userId: string): CartEntity {
    return {
      id: '',
      userId,
      currency: 'USD',
      items: [],
      summary: {
        itemCount: 0,
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        grandTotal: 0,
      },
    };
  }
}
