import { Injectable } from '@nestjs/common';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderCards(days = 30) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - safeDays);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - safeDays);

    const baseWhere = {
      placedAt: { gte: currentStart, lte: now },
    };

    const previousWhere = {
      placedAt: { gte: previousStart, lt: currentStart },
    };

    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      prevTotalOrders,
      prevPendingOrders,
      prevCompletedOrders,
      prevCancelledOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: { status: OrderStatus.PENDING_PAYMENT },
      }),
      this.prisma.order.count({
        where: {
          status: {
            notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
          },
        },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
      this.prisma.order.count({ where: previousWhere }),
      this.prisma.order.count({
        where: {
          ...previousWhere,
          status: OrderStatus.PENDING_PAYMENT,
        },
      }),
      this.prisma.order.count({
        where: {
          ...previousWhere,
          status: {
            notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...previousWhere,
          status: OrderStatus.CANCELLED,
        },
      }),
    ]);

    const currentTotalOrders = await this.prisma.order.count({
      where: baseWhere,
    });
    const currentPendingOrders = await this.prisma.order.count({
      where: { ...baseWhere, status: OrderStatus.PENDING_PAYMENT },
    });
    const currentCompletedOrders = await this.prisma.order.count({
      where: {
        ...baseWhere,
        status: {
          notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
        },
      },
    });
    const currentCancelledOrders = await this.prisma.order.count({
      where: { ...baseWhere, status: OrderStatus.CANCELLED },
    });

    return {
      periodDays: safeDays,
      cards: {
        totalOrders: {
          value: totalOrders,
          growthPercent: this.calculateGrowthPercent(
            currentTotalOrders,
            prevTotalOrders,
          ),
        },
        pendingOrders: {
          value: pendingOrders,
          growthPercent: this.calculateGrowthPercent(
            currentPendingOrders,
            prevPendingOrders,
          ),
        },
        completedOrders: {
          value: completedOrders,
          growthPercent: this.calculateGrowthPercent(
            currentCompletedOrders,
            prevCompletedOrders,
          ),
        },
        cancelledOrders: {
          value: cancelledOrders,
          growthPercent: this.calculateGrowthPercent(
            currentCancelledOrders,
            prevCancelledOrders,
          ),
        },
      },
    };
  }

  async getOverview(days = 30) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - safeDays);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - safeDays);

    const [
      totalVisitors,
      currentVisitors,
      previousVisitors,
      totalProducts,
      currentProducts,
      previousProducts,
      totalEngagement,
      currentEngagement,
      previousEngagement,
      avgOrderAllTime,
      avgOrderCurrent,
      avgOrderPrevious,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: Role.CUSTOMER,
        },
      }),
      this.prisma.user.count({
        where: {
          role: Role.CUSTOMER,
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.user.count({
        where: {
          role: Role.CUSTOMER,
          createdAt: { gte: previousStart, lt: currentStart },
        },
      }),
      this.prisma.product.count({
        where: {
          status: { not: ProductStatus.DISCONTINUED },
        },
      }),
      this.prisma.product.count({
        where: {
          status: { not: ProductStatus.DISCONTINUED },
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.product.count({
        where: {
          status: { not: ProductStatus.DISCONTINUED },
          createdAt: { gte: previousStart, lt: currentStart },
        },
      }),
      this.prisma.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: {
            status: { not: OrderStatus.CANCELLED },
          },
        },
      }),
      this.prisma.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: {
            status: { not: OrderStatus.CANCELLED },
            placedAt: { gte: currentStart, lte: now },
          },
        },
      }),
      this.prisma.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: {
            status: { not: OrderStatus.CANCELLED },
            placedAt: { gte: previousStart, lt: currentStart },
          },
        },
      }),
      this.prisma.order.aggregate({
        _avg: { grandTotal: true },
        where: {
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.order.aggregate({
        _avg: { grandTotal: true },
        where: {
          status: { not: OrderStatus.CANCELLED },
          placedAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.order.aggregate({
        _avg: { grandTotal: true },
        where: {
          status: { not: OrderStatus.CANCELLED },
          placedAt: { gte: previousStart, lt: currentStart },
        },
      }),
    ]);

    const totalProductViews = totalEngagement._sum.quantity ?? 0;
    const currentProductViews = currentEngagement._sum.quantity ?? 0;
    const previousProductViews = previousEngagement._sum.quantity ?? 0;

    const averageOrders = this.decimalToNumber(avgOrderAllTime._avg.grandTotal);
    const currentAverageOrders = this.decimalToNumber(
      avgOrderCurrent._avg.grandTotal,
    );
    const previousAverageOrders = this.decimalToNumber(
      avgOrderPrevious._avg.grandTotal,
    );

    return {
      periodDays: safeDays,
      cards: {
        totalVisitor: {
          value: totalVisitors,
          growthPercent: this.calculateGrowthPercent(
            currentVisitors,
            previousVisitors,
          ),
        },
        totalProducts: {
          value: totalProducts,
          growthPercent: this.calculateGrowthPercent(
            currentProducts,
            previousProducts,
          ),
        },
        totalProductViews: {
          value: totalProductViews,
          growthPercent: this.calculateGrowthPercent(
            currentProductViews,
            previousProductViews,
          ),
          note: 'Derived from sold item quantity because product view tracking is not stored yet.',
        },
        averageOrders: {
          value: averageOrders,
          growthPercent: this.calculateGrowthPercent(
            currentAverageOrders,
            previousAverageOrders,
          ),
          currency: 'USD',
        },
      },
    };
  }

  private decimalToNumber(
    value: { toNumber: () => number } | number | null | undefined,
  ): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return value.toNumber();
  }

  private calculateGrowthPercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    const growth = ((current - previous) / previous) * 100;
    return Number(growth.toFixed(2));
  }
}
