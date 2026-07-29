import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionService } from '../admin-action/admin-action.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { AddTrackingEventDto } from './dto/add-tracking-event.dto';
import { OrderStatus, ShippingStatus } from '@prisma/client';

import { MailService } from '../mail/mail.service';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAction: AdminActionService,
    private readonly mail: MailService,
  ) {}

  async createShipment(adminId: string, dto: CreateShipmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { shippingAddress: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException(`Cannot ship order with status ${order.status}`);
    }

    const shipment = await this.prisma.shipment.create({
      data: {
        orderId: dto.orderId,
        carrier: dto.carrier,
        method: dto.method,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        items: dto.items as any,
        shippingAddress: order.shippingAddress as any,
        estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
        status: ShippingStatus.IN_TRANSIT,
        shippedAt: new Date(),
        events: {
          create: {
            status: 'Shipped',
            description: 'Package has been handed over to the carrier.',
            timestamp: new Date(),
          },
        },
      },
    });

    // Automatically update order status to SHIPPED
    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: OrderStatus.SHIPPED },
    });

    await this.adminAction.logAction(
      adminId,
      'CREATE_SHIPMENT',
      'Shipment',
      shipment.id,
      `Created shipment for order ${dto.orderId}`
    );

    return shipment;
  }

  async addTrackingEvent(adminId: string, shipmentId: string, dto: AddTrackingEventDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const event = await this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: dto.status,
        description: dto.description,
        location: dto.location,
        timestamp: new Date(),
      },
    });

    if (dto.updateShipmentStatus) {
      const updateData: any = { status: dto.updateShipmentStatus };
      if (dto.updateShipmentStatus === ShippingStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
      }
      
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: updateData,
      });

      if (dto.updateShipmentStatus === ShippingStatus.DELIVERED) {
        await this.prisma.order.update({
          where: { id: shipment.orderId },
          data: { status: OrderStatus.DELIVERED, deliveredAt: new Date() },
        });
        this.sendDeliveredReviewEmail(shipment.orderId).catch(() => {});
      }
    }

    await this.adminAction.logAction(
      adminId,
      'ADD_TRACKING_EVENT',
      'Shipment',
      shipment.id,
      `Added tracking event: ${dto.status}`
    );

    return event;
  }

  async getShipmentTracking(orderId: string) {
    const shipments = await this.prisma.shipment.findMany({
      where: { orderId },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!shipments || shipments.length === 0) {
      throw new NotFoundException('No shipments found for this order');
    }

    return shipments;
  }

  private async sendDeliveredReviewEmail(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          shippingAddress: true,
          items: {
            include: { variant: true },
          },
        },
      });

      if (!order) return;

      const recipientEmail =
        order.user?.email ||
        order.guestEmail;
      if (!recipientEmail) return;

      const recipientName =
        [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') ||
        [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' ') ||
        'Valued Customer';

      const items = (order.items || []).map((item) => ({
        productName: item.productName || 'Product',
        variantName: item.variantName || undefined,
        imageUrl: item.imageUrl || undefined,
        productSlugOrId: item.variant?.productId || '',
      }));

      if (items.length > 0 && this.mail) {
        await this.mail.sendOrderDeliveredReviewNotification(
          recipientEmail,
          order.orderNumber,
          recipientName,
          items,
        );
      }
    } catch {}
  }
}
