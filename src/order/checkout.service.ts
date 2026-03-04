// src/order/checkout.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto, CheckoutResult } from './dto';
import { PaymentMethodType } from '@prisma/client';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly prisma: PrismaService,
  ) {}

  // Validate checkout
  async validateCheckout(userId: string): Promise<any> {
    const cart = await this.cartService.getCart(userId);
    const issues: string[] = [];

    if (cart.items.length === 0) {
      issues.push('Cart is empty');
    }

    for (const item of cart.items) {
      if (item.quantity > item.stockAvailable) {
        issues.push(
          `${item.productName}: Only ${item.stockAvailable} available`,
        );
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      cart,
    };
  }

  // Process checkout
  async processCheckout(
    userId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResult> {
    // Validate
    const validation = await this.validateCheckout(userId);
    if (!validation.isValid) {
      throw new BadRequestException(validation.issues);
    }

    // Create order
    const order = await this.orderService.createOrderFromCart(userId, {
      shippingAddressId: dto.shippingAddressId,
      billingAddressId: dto.billingAddressId,
      couponCode: dto.couponCode,
    });

    // Process payment (mock)
    const payment = await this.processPayment(
      order.id,
      order.grandTotal,
      dto.paymentMethod,
    );

    // Update order if payment successful
    if (payment.status === 'CAPTURED') {
      await this.orderService.updateOrderStatus(
        order.id,
        'PAYMENT_CONFIRMED',
        'system',
        'Payment completed',
      );
    }

    return {
      order,
      payment: {
        status: payment.status,
        redirectUrl: payment.redirectUrl,
      },
    };
  }

  // Mock payment processing
  private async processPayment(
    orderId: string,
    amount: number,
    method: PaymentMethodType,
  ): Promise<any> {
    // Integrate with Stripe/PayPal here
    // This is a mock implementation

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        currency: 'USD',
        status: 'CAPTURED',
        method,
        provider: 'stripe',
        providerTxnId: `txn_${Date.now()}`,
        processedAt: new Date(),
      },
    });

    return {
      status: payment.status,
      redirectUrl: null, // Set if 3D Secure required
    };
  }
}
