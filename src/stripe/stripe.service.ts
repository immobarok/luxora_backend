import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not defined in the environment variables',
      );
    }

    this.stripe = new Stripe(stripeSecretKey || '', {
      apiVersion: '2026-02-25.clover',
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    orderId: string,
    metadata?: Record<string, string>,
  ) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          orderId,
          ...metadata,
        },
      });
      return paymentIntent;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Stripe error';
      this.logger.error(`Failed to create payment intent: ${errorMessage}`);
      throw error;
    }
  }

  async createCheckoutSession(input: {
    orderId: string;
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amount,
            product_data: {
              name: `Order ${input.orderId}`,
            },
          },
        },
      ],
      metadata: {
        orderId: input.orderId,
      },
      payment_intent_data: {
        metadata: {
          orderId: input.orderId,
        },
      },
    });
  }

  async getPaymentIntentById(paymentIntentId: string) {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is missing');
    }
    return await this.stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  }
}
