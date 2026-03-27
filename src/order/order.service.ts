// src/order/order.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  OrderStatus as PrismaOrderStatus,
  Order,
  OrderItem,
  Address,
  Payment,
  Shipment,
} from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto, OrderQueryDto, OrderStatus } from './dto';
import { OrderEntity } from './entities/order.entity';

const userOrderListInclude = Prisma.validator<Prisma.OrderInclude>()({
  items: { take: 1 },
  payments: { where: { status: 'CAPTURED' }, take: 1 },
});

const adminOrderListInclude = Prisma.validator<Prisma.OrderInclude>()({
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  items: { take: 1 },
  _count: { select: { items: true } },
});

type UserOrderListItem = Prisma.OrderGetPayload<{
  include: typeof userOrderListInclude;
}>;
type AdminOrderListItem = Prisma.OrderGetPayload<{
  include: typeof adminOrderListInclude;
}>;
type OrderForEntity = Order & {
  items?: OrderItem[];
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  payments?: Payment[];
  shipments?: Shipment[];
};
type AdminOrderQuery = OrderQueryDto & {
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  // Create order from cart
  async createOrderFromCart(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    if (dto.couponCode) {
      await this.cartService.applyCoupon(userId, { code: dto.couponCode });
    }

    // Get cart with items
    const cart = await this.cartService.getCart(userId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (item.quantity > item.stockAvailable) {
        throw new BadRequestException(
          `${item.productName}: Only ${item.stockAvailable} available, requested ${item.quantity}`,
        );
      }
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const { shippingAddressId, billingAddressId } =
        await this.resolveAddressIds(userId, dto, tx);

      // Deduct inventory
      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            quantity: { decrement: item.quantity },
            stockStatus: {
              set: item.quantity >= 10 ? 'IN_STOCK' : 'LOW_STOCK',
            },
          },
        });
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          shippingMethod: 'STANDARD',
          currency: cart.currency,
          subtotal: cart.summary.subtotal,
          taxTotal: cart.summary.taxTotal,
          shippingTotal: cart.summary.shippingTotal,
          discountTotal: cart.summary.discountTotal,
          grandTotal: cart.summary.grandTotal,
          couponCode: cart.couponCode || null,
          couponDiscount: cart.summary.discountTotal || null,
          shippingAddressId,
          billingAddressId,
          giftMessage: dto.giftMessage,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              imageUrl: item.imageUrl,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
            })),
          },
          statusHistory: {
            create: {
              status: 'PENDING_PAYMENT',
              comment: 'Order created from cart',
            },
          },
        },
        include: {
          items: true,
          shippingAddress: true,
          billingAddress: true,
        },
      });

      if (newOrder.couponCode) {
        await tx.coupon.update({
          where: { code: newOrder.couponCode },
          data: { usageCount: { increment: 1 } },
        });
      }

      return newOrder;
    });

    return this.mapOrderToEntity(order);
  }

  // Get order by ID
  async getOrderById(
    orderId: string,
    userId: string,
    email?: string,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ userId }, ...(email ? [{ guestEmail: email }] : [])],
      },
      include: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: true,
        shipments: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToEntity(order);
  }

  // Get order by ID (Admin)
  async getOrderByIdForAdmin(orderId: string): Promise<OrderEntity> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: true,
        shipments: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToEntity(order);
  }

  // Get order by number (for guests)
  async getOrderByNumber(
    orderNumber: string,
    email: string,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        OR: [{ user: { email } }, { guestEmail: email }],
      },
      include: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: { where: { status: 'CAPTURED' } },
        shipments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToEntity(order);
  }

  // Get user orders
  async getUserOrders(userId: string, query: OrderQueryDto, email?: string) {
    const { page = 1, limit = 10, status, search } = query;

    const ownershipFilter: Prisma.OrderWhereInput = {
      OR: [{ userId }, ...(email ? [{ guestEmail: email }] : [])],
    };

    const andFilters: Prisma.OrderWhereInput[] = [ownershipFilter];

    if (status) {
      andFilters.push({ status });
    }

    if (search) {
      andFilters.push({
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          {
            items: {
              some: {
                productName: { contains: search, mode: 'insensitive' as const },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = {
      AND: andFilters,
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { placedAt: 'desc' },
        include: userOrderListInclude,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order: UserOrderListItem) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toNumber(),
        itemCount: order.items.length,
        firstItemImage: order.items[0]?.imageUrl || null,
        placedAt: order.placedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Update order status (Admin)
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    adminId: string,
    comment?: string,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transition
    const validTransitions = this.getValidStatusTransitions(order.status);
    if (!validTransitions.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    const updateData: Prisma.OrderUpdateInput = {
      status,
      statusHistory: {
        create: {
          status,
          comment: comment || `Status updated to ${status}`,
          createdBy: adminId,
        },
      },
    };

    // Set timestamps based on status
    if (status === 'PAYMENT_CONFIRMED') updateData.paidAt = new Date();
    if (status === 'PROCESSING') updateData.processedAt = new Date();
    if (status === 'SHIPPED') updateData.shippedAt = new Date();
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    // Update payment status if paid
    if (status === 'PAYMENT_CONFIRMED') {
      updateData.paymentStatus = 'CAPTURED';
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        shippingAddress: true,
        billingAddress: true,
        payments: true,
        shipments: true,
      },
    });

    return this.mapOrderToEntity(updated);
  }

  // Cancel order
  async cancelOrder(
    orderId: string,
    userId: string,
    reason: string,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only allow cancellation for pending or paid orders
    if (
      !['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING'].includes(
        order.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot cancel order with status: ${order.status}`,
      );
    }

    // Restore inventory
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            quantity: { increment: item.quantity },
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          statusHistory: {
            create: {
              status: 'CANCELLED',
              comment: `Cancelled by user. Reason: ${reason}`,
            },
          },
        },
        include: {
          items: true,
          shippingAddress: true,
          billingAddress: true,
          payments: true,
          shipments: true,
        },
      });
    });

    return this.mapOrderToEntity(updated);
  }

  // Get all orders (Admin)
  async getAllOrders(query: AdminOrderQuery) {
    const { page = 1, limit = 10, status, startDate, endDate } = query;

    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (startDate || endDate) {
      where.placedAt = {};
      if (startDate) where.placedAt.gte = new Date(startDate);
      if (endDate) where.placedAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { placedAt: 'desc' },
        include: adminOrderListInclude,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order: AdminOrderListItem) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.user
          ? {
              id: order.user.id,
              name: `${order.user.firstName} ${order.user.lastName}`,
              email: order.user.email,
            }
          : { email: 'Guest' },
        status: order.status,
        paymentStatus: order.paymentStatus,
        grandTotal: order.grandTotal.toNumber(),
        itemCount: order._count.items,
        placedAt: order.placedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get order statistics (Admin)
  async getOrderStats() {
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      todayRevenue,
      monthRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } }),
      this.prisma.order.aggregate({
        where: {
          status: 'PAYMENT_CONFIRMED',
          paidAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: 'PAYMENT_CONFIRMED',
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      todayRevenue: todayRevenue._sum?.grandTotal?.toNumber() || 0,
      monthRevenue: monthRevenue._sum?.grandTotal?.toNumber() || 0,
    };
  }

  // Helper: Generate unique order number
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const prefix = `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const count = await this.prisma.order.count({
      where: {
        orderNumber: { startsWith: prefix },
      },
    });

    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private async resolveAddressIds(
    userId: string,
    dto: CreateOrderDto,
    tx: Prisma.TransactionClient,
  ): Promise<{ shippingAddressId: string; billingAddressId: string }> {
    let shippingAddressId = dto.shippingAddressId;

    if (!shippingAddressId && dto.shippingAddress) {
      const created = await tx.address.create({
        data: {
          userId,
          type: 'SHIPPING',
          isDefault: false,
          firstName: dto.shippingAddress.firstName,
          lastName: dto.shippingAddress.lastName,
          phone: dto.shippingAddress.phone,
          line1: dto.shippingAddress.line1,
          line2: dto.shippingAddress.line2,
          city: dto.shippingAddress.city,
          state: dto.shippingAddress.state,
          postalCode: dto.shippingAddress.postalCode,
          country: dto.shippingAddress.country,
        },
      });
      shippingAddressId = created.id;
    }

    if (!shippingAddressId) {
      throw new BadRequestException('Shipping address is required');
    }

    let billingAddressId = dto.billingAddressId;

    if (!billingAddressId && dto.billingAddress) {
      const created = await tx.address.create({
        data: {
          userId,
          type: 'BILLING',
          isDefault: false,
          firstName: dto.billingAddress.firstName,
          lastName: dto.billingAddress.lastName,
          phone: dto.billingAddress.phone,
          line1: dto.billingAddress.line1,
          line2: dto.billingAddress.line2,
          city: dto.billingAddress.city,
          state: dto.billingAddress.state,
          postalCode: dto.billingAddress.postalCode,
          country: dto.billingAddress.country,
        },
      });
      billingAddressId = created.id;
    }

    if (!billingAddressId) {
      billingAddressId = shippingAddressId;
    }

    return { shippingAddressId, billingAddressId };
  }

  // Helper: Get valid status transitions
  private getValidStatusTransitions(
    currentStatus: PrismaOrderStatus,
  ): PrismaOrderStatus[] {
    const transitions: Record<PrismaOrderStatus, PrismaOrderStatus[]> = {
      PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'CANCELLED'],
      PAYMENT_CONFIRMED: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
      PICKED: ['PACKED', 'CANCELLED'],
      PACKED: ['SHIPPED', 'CANCELLED'],
      IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'DELIVERED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
      RETURN_REQUESTED: ['RETURNED', 'CANCELLED'],
      RETURNED: ['REFUNDED'],
      FAILED_DELIVERY: ['IN_TRANSIT', 'CANCELLED'],
    };

    return transitions[currentStatus] ?? [];
  }

  // Helper: Map Prisma order to entity
  private mapOrderToEntity(order: OrderForEntity): OrderEntity {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal?.toNumber() || 0,
      discountTotal: order.discountTotal?.toNumber() || 0,
      taxTotal: order.taxTotal?.toNumber() || 0,
      shippingTotal: order.shippingTotal?.toNumber() || 0,
      grandTotal: order.grandTotal?.toNumber() || 0,
      couponCode: order.couponCode,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items:
        order.items?.map((item) => ({
          id: item.id,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          imageUrl: item.imageUrl,
          unitPrice: item.unitPrice?.toNumber() || 0,
          quantity: item.quantity,
          totalPrice: item.totalPrice?.toNumber() || 0,
          discountAmount: item.discountAmount?.toNumber() || null,
          status: item.status,
          returnedQuantity: item.returnedQuantity,
        })) || [],
      shippingAddress: order.shippingAddress
        ? {
            id: order.shippingAddress.id,
            name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
            phone: order.shippingAddress.phone,
            addressLine1: order.shippingAddress.line1,
            addressLine2: order.shippingAddress.line2,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            postalCode: order.shippingAddress.postalCode,
            country: order.shippingAddress.country,
          }
        : null,
      billingAddress: order.billingAddress
        ? {
            id: order.billingAddress.id,
            name: `${order.billingAddress.firstName} ${order.billingAddress.lastName}`,
            phone: order.billingAddress.phone,
            addressLine1: order.billingAddress.line1,
            addressLine2: order.billingAddress.line2,
            city: order.billingAddress.city,
            state: order.billingAddress.state,
            postalCode: order.billingAddress.postalCode,
            country: order.billingAddress.country,
          }
        : null,
      payments:
        order.payments?.map((p) => ({
          id: p.id,
          amount: p.amount?.toNumber() || 0,
          status: p.status,
          method: p.method,
          provider: p.provider,
          processedAt: p.processedAt,
        })) || [],
      shipments:
        order.shipments?.map((s) => ({
          id: s.id,
          trackingNumber: s.trackingNumber,
          carrier: s.carrier,
          status: s.status,
          shippedAt: s.shippedAt,
          deliveredAt: s.deliveredAt,
        })) || [],
    };
  }
}
