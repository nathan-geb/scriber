import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService implements OnModuleInit {
  private stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-01-27' as any,
      });
    }
  }

  onModuleInit() {
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set. Billing service will be disabled.',
      );
    }
  }

  async createCheckoutSession(userId: string, planId: string) {
    if (!this.stripe) throw new Error('Stripe is not configured');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: `Transcription plan: ${plan.monthlyMinutesLimit} minutes/month`,
            },
            unit_amount: Math.round(Number(plan.price) * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${this.configService.get(
        'FRONTEND_URL',
      )}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/billing/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        planId: plan.id,
      },
    });

    return session;
  }

  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) return;

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    ) || '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw err;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const { userId, planId } = session.metadata as { userId: string; planId: string };

    // Update or create subscription in DB
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        active: true,
      },
      update: {
        planId,
        active: true,
      },
    });

    this.logger.log(
      `Subscription activated for user ${userId} on plan ${planId}`,
    );
  }

  async reportUsage(userId: string, minutes: number) {
    if (!this.stripe) return;

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription || !subscription.active) return;

      // In a real app, you'd store Stripe's subscription_item_id in the DB
      // For now, we'll fetch the subscription to find the item ID
      // This is less efficient but avoids schema changes for now
      const stripeSubs = await this.stripe.subscriptions.list({
        customer: await this.getStripeCustomerId(userId),
        limit: 1,
      });

      if (stripeSubs.data.length > 0) {
        // Usage records API has changed in Stripe API version 2024-06-20
        // Need to use the new Billing Meters API
        // const itemId = stripeSubs.data[0].items.data[0].id;
        // await this.stripe.subscriptionItems.createUsageRecord(itemId, {
        //   quantity: minutes,
        //   timestamp: 'now',
        //   action: 'increment',
        // });
        this.logger.log(
          `Usage tracking not implemented for current Stripe API version. Reported ${minutes} minutes usage for user ${userId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to report usage to Stripe: ${error.message}`);
    }
  }

  private async getStripeCustomerId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // In a production app, you'd store stripeCustomerId in User model
    // Here we search by email
    const customers = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (customers.data.length > 0) return customers.data[0].id;

    const customer = await this.stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
    });
    return customer.id;
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    // Match by customer ID
    const customerId = subscription.customer as string;
    const customer = (await this.stripe.customers.retrieve(
      customerId,
    )) as Stripe.Customer;

    if (customer.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: customer.email },
      });
      if (user) {
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: { active: false },
        });
        this.logger.log(`Deactivated subscription for user ${user.id}`);
      }
    }
  }
}
