import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';

import { StripeCustomersRepository } from './repositories/stripe-customers.repository';
import { StripeSubscriptionsRepository } from './repositories/stripe-subscriptions.repository';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly customersRepo: StripeCustomersRepository,
    private readonly subsRepo: StripeSubscriptionsRepository,

    // 👇 add this
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET!);
  }

  async createCheckoutForUser(input: {
    userId: number;
    email: string | null;
    priceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const { userId, email, priceId, successUrl, cancelUrl } = input;
    const existing = await this.customersRepo.findByUserId(userId);

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: successUrl ?? process.env.STRIPE_SUCCESS_URL!,
      cancel_url: cancelUrl ?? process.env.STRIPE_CANCEL_URL!,
      line_items: [
        { price: priceId ?? process.env.STRIPE_PRICE_ID!, quantity: 1 },
      ],
      allow_promotion_codes: true,
      metadata: { appUserId: String(userId) },
      subscription_data: { metadata: { appUserId: String(userId) } },
      client_reference_id: String(userId),
    };

    if (existing?.stripeCustomerId) params.customer = existing.stripeCustomerId;
    else if (email) params.customer_email = email;

    return this.stripe.checkout.sessions.create(params);
  }

  async createBillingPortalSession(customerId: string, returnUrl: string) {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature as string,
      secret,
    );
  }

  async handleEvent(event: Stripe.Event) {
    this.logger.log(`stripe: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const stripeCustomerId = (session.customer as string) ?? '';
        const email =
          session.customer_details?.email ?? session.customer_email ?? null;

        const appUserIdRaw = session.metadata?.appUserId;
        const appUserId =
          appUserIdRaw && !isNaN(Number(appUserIdRaw))
            ? Number(appUserIdRaw)
            : null;

        const customer = await this.customersRepo.upsertByStripeCustomerId({
          stripeCustomerId,
          email,
          userId: appUserId,
        });

        if (session.subscription) {
          const fetched = await this.stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          const sub = fetched as unknown as Stripe.Subscription; // normalize type
          const { start, end } = this.getCurrentPeriodDates(sub);

          await this.subsRepo.upsertForCustomer({
            customerId: customer.id,
            stripeSubscriptionId: sub.id,
            status: sub.status as any,
            priceId: (sub.items?.data?.[0]?.price?.id as string) ?? null,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            currentPeriodStart: start,
            currentPeriodEnd: end,
          });

          // 👇 flip the user's tier here
          await this.syncUserTier(customer.userId ?? null, sub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;

        // 1) Find or create customer row
        let customer =
          (await this.customersRepo.findByStripeCustomerId(stripeCustomerId)) ??
          (await this.customersRepo.upsertByStripeCustomerId({
            stripeCustomerId,
            email: null,
          }));

        // 2) Resolve app user id from metadata (set in checkout + subscription_data)
        const metaUserIdRaw = sub.metadata?.appUserId;
        const metaUserId =
          metaUserIdRaw && !isNaN(Number(metaUserIdRaw))
            ? Number(metaUserIdRaw)
            : null;

        // Optional hard fallback: check Stripe Customer metadata too
        let resolvedUserId = customer.userId ?? metaUserId ?? null;
        if (!resolvedUserId) {
          try {
            const sc = await this.stripe.customers.retrieve(stripeCustomerId);
            const cMeta = (sc as Stripe.Customer).metadata?.appUserId;
            if (cMeta && !isNaN(Number(cMeta))) resolvedUserId = Number(cMeta);
          } catch {}
        }

        // 3) If we learned the app user id and the DB row lacks it, save it so future events work
        if (resolvedUserId && !customer.userId) {
          customer = await this.customersRepo.upsertByStripeCustomerId({
            stripeCustomerId,
            email: customer.email ?? null,
            userId: resolvedUserId,
          });
        }

        const { start, end } = this.getCurrentPeriodDates(sub);

        await this.subsRepo.upsertForCustomer({
          customerId: customer.id,
          stripeSubscriptionId: sub.id,
          status: sub.status as any,
          priceId: (sub.items?.data?.[0]?.price?.id as string) ?? null,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          currentPeriodStart: start,
          currentPeriodEnd: end,
        });

        // ✅ Use the resolved id, not possibly-null customer.userId
        await this.syncUserTier(resolvedUserId, sub);
        break;
      }

      // optional: handle payment failures, etc.
      default:
        break;
    }
  }

  // In StripeService
  private getCurrentPeriodDates(sub: any) {
    const startUnix =
      sub.current_period_start ??
      sub.current_period?.start ??
      sub.billing_cycle?.current_period?.start ??
      sub.trial_start ??
      sub.created ??
      null;

    let endUnix =
      sub.current_period_end ??
      sub.current_period?.end ??
      sub.billing_cycle?.current_period?.end ??
      sub.trial_end ??
      null;

    // Fallback: 31 days after start
    if (!endUnix && startUnix) {
      const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60; // seconds
      endUnix = startUnix + THIRTY_ONE_DAYS;
    }

    return {
      start: startUnix ? new Date(startUnix * 1000) : null,
      end: endUnix ? new Date(endUnix * 1000) : null,
    };
  }

  private async syncUserTier(userId: number | null, sub: Stripe.Subscription) {
    if (!userId) return;

    const status = sub.status;
    const { start, end } = this.getCurrentPeriodDates(sub);

    // If Stripe still gave no end, force start + 31 days (or now + 31 if no start)
    const forcedEnd =
      end ?? (start ? this.addDays(start, 31) : this.addDays(new Date(), 31));

    if (status === 'active' || status === 'trialing') {
      await this.usersRepo.update(
        { id: userId },
        {
          tier: 'plus',
          subscriptionStartDate: start ?? new Date(),
          subscriptionEndDate: forcedEnd,
        },
      );
    } else if (
      status === 'canceled' ||
      status === 'unpaid' ||
      status === 'incomplete_expired' ||
      status === 'past_due'
    ) {
      await this.usersRepo.update(
        { id: userId },
        {
          tier: 'basic',
          // keep original start; mark a forced end
          subscriptionEndDate: forcedEnd,
        },
      );
    }
  }

  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}
