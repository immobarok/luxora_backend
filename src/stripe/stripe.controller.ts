import {
  Controller,
  Post,
  Headers,
  Req,
  Res,
  Logger,
  HttpStatus,
  Body,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import * as Express from 'express';
import { Public } from '../common/decorators/public.decorator';
import Stripe from 'stripe';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  private getOrderIdFromMetadata(metadata: Stripe.Metadata): string | null {
    const orderId = metadata.orderId;
    return typeof orderId === 'string' && orderId.length > 0 ? orderId : null;
  }

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('create-payment-intent')
  async createPaymentIntent(
    @Body('orderId') orderId: string,
    @Res() res: Express.Response,
  ) {
    if (!orderId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Order ID is required' });
    }

    try {
      // Find the order to get the correct amount
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ message: 'Order not found' });
      }

      const amountToCharge = Math.round(Number(order.grandTotal) * 100);
      const successUrl =
        process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
        'http://localhost:3000/orders/success';
      const cancelUrl =
        process.env.STRIPE_CHECKOUT_CANCEL_URL ??
        'http://localhost:3000/orders/cancel';

      // Create PaymentIntent (for frontend integrations using Stripe Elements)
      const paymentIntent = await this.stripeService.createPaymentIntent(
        amountToCharge,
        order.currency || 'usd',
        order.id, // Put the orderId in Stripe metadata
      );

      // Create Checkout Session (for frontend integrations expecting checkoutUrl)
      const checkoutSession = await this.stripeService.createCheckoutSession({
        orderId: order.id,
        amount: amountToCharge,
        currency: order.currency || 'usd',
        successUrl,
        cancelUrl,
      });

      // Return both response formats so website/app clients can use either flow
      return res.status(HttpStatus.OK).json({
        clientSecret: paymentIntent.client_secret,
        checkoutUrl: checkoutSession.url,
        checkoutSessionId: checkoutSession.id,
        amount: amountToCharge,
        currency: order.currency || 'usd',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: errorMessage });
    }
  }

  @Post('webhook')
  @Public()
  async handleWebhook(
    @Req() req: RawBodyRequest<Express.Request>,
    @Res() res: Express.Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const isBypass = process.env.STRIPE_WEBHOOK_BYPASS === 'true';

    if (!signature && !isBypass) {
      this.logger.warn('Missing stripe-signature header');
      return res.status(HttpStatus.BAD_REQUEST).send('Missing signature');
    }

    try {
      if (!req.rawBody && !isBypass) {
        this.logger.warn('Missing raw request body for webhook verification');
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send('Missing raw request body');
      }

      // Use the raw body of the request to verify the webhook signature
      const event = isBypass
        ? (req.body as Stripe.Event)
        : await this.stripeService.constructWebhookEvent(
            req.rawBody!,
            signature,
          );

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntentRef = event.data.object as { id?: string };
          if (!paymentIntentRef.id) {
            this.logger.warn('Payment intent succeeded event missing id');
            break;
          }

          let paymentIntent: Stripe.PaymentIntent;
          if (isBypass && !paymentIntentRef.id.startsWith('pi_')) {
            // During a non-Stripe fake POST test, just mock the full intent object
            // to avoid hitting Stripe's real API with dummy IDs like 'cmn57...'
            this.logger.warn(
              `Bypassing Stripe API fetch for fake test ID: ${paymentIntentRef.id}`,
            );
            paymentIntent = event.data.object;
          } else {
            paymentIntent = await this.stripeService.getPaymentIntentById(
              paymentIntentRef.id,
            );
          }

          const orderId = this.getOrderIdFromMetadata(paymentIntent.metadata);

          this.logger.log(
            `Payment successful for order: ${orderId ?? 'missing-metadata'}`,
          );
          if (orderId) {
            try {
              const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                  status: 'PAYMENT_CONFIRMED',
                  paymentStatus: 'CAPTURED',
                  paidAt: new Date(),
                  statusHistory: {
                    create: {
                      status: 'PAYMENT_CONFIRMED',
                      comment: 'Payment confirmed via Stripe webhook',
                    },
                  },
                },
              });

              // For card/online payments, clear cart only after payment success.
              await this.prisma.cartItem.deleteMany({
                where: { cart: { userId: updatedOrder.userId } },
              });
              await this.prisma.cart.updateMany({
                where: { userId: updatedOrder.userId },
                data: {
                  subtotal: 0,
                  taxTotal: 0,
                  shippingTotal: 0,
                  discountTotal: 0,
                  grandTotal: 0,
                  couponCode: null,
                  couponDiscount: 0,
                },
              });
            } catch (err) {
              if (
                err &&
                typeof err === 'object' &&
                'code' in err &&
                err.code === 'P2025' // P2025 = "Record to update not found"
              ) {
                this.logger.warn(
                  `Stripe confirmed payment for order ${orderId}, but order does not exist in DB.`,
                );
              } else {
                throw err;
              }
            }
          } else {
            this.logger.warn('Payment intent missing orderId metadata');
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const failedIntentRef = event.data.object as { id?: string };
          if (!failedIntentRef.id) {
            this.logger.warn('Payment intent failed event missing id');
            break;
          }

          const failedIntent = await this.stripeService.getPaymentIntentById(
            failedIntentRef.id,
          );
          this.logger.warn(
            `Payment failed for order ${failedIntent.metadata?.orderId}`,
          );
          break;
        }
        // ... handle other event types
        default:
          this.logger.log(`Unhandled event type ${event.type}`);
      }

      // Return a 200 res to acknowledge receipt of the event
      res.status(HttpStatus.OK).end();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown webhook error';
      this.logger.error(`Webhook error: ${errorMessage}`);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(`Webhook Error: ${errorMessage}`);
    }
  }
}
