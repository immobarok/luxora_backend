// src/order/checkout.service.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { OrderService } from './order.service';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto, CheckoutResult } from './dto';
import { PaymentMethodType, PaymentStatus } from '@prisma/client';
import { CartEntity } from '../cart/entities/cart.entity';
import { MailService } from '../mail/mail.service';

export interface CheckoutValidationResult {
  isValid: boolean;
  issues: string[];
  cart: CartEntity;
}

interface PaymentProcessResult {
  status: PaymentStatus;
  redirectUrl?: string;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // Validate checkout
  async validateCheckout(userId: string): Promise<CheckoutValidationResult> {
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
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
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

    // Clear cart only for COD or when payment is successfully captured.
    if (
      dto.paymentMethod === PaymentMethodType.COD ||
      payment.status === PaymentStatus.CAPTURED
    ) {
      await this.cartService.clearCart(userId);
    }

    // Send order confirmation email only after successful payment capture.
    if (payment.status === PaymentStatus.CAPTURED) {
      const customer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (customer?.email) {
        const customerName =
          `${customer.firstName} ${customer.lastName}`.trim();
        this.mailService
          .sendOrderConfirmation(
            customer.email,
            order.orderNumber,
            customerName || customer.email,
            order.id,
          )
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.stack : String(err);
            this.logger.error(
              `Failed to send order confirmation for order ${order.orderNumber}`,
              errorMessage,
            );
          });
      }
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
  ): Promise<PaymentProcessResult> {
    // Integrate with Stripe/PayPal here
    // This is a mock implementation

    const isCod = method === PaymentMethodType.COD;
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        currency: 'USD',
        status: isCod ? 'CAPTURED' : 'PENDING',
        method,
        provider: isCod ? 'cod' : 'stripe',
        providerTxnId: isCod ? undefined : `txn_${Date.now()}`,
        processedAt: isCod ? new Date() : undefined,
      },
    });

    return {
      status: payment.status,
      redirectUrl: undefined, // Set if 3D Secure required
    };
  }
}
