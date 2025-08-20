import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeSubscription } from '../entities/stripe-subscription.entity';

@Injectable()
export class StripeSubscriptionsRepository {
  constructor(
    @InjectRepository(StripeSubscription)
    private readonly repo: Repository<StripeSubscription>,
  ) {}

  findByStripeSubscriptionId(stripeSubscriptionId: string) {
    return this.repo.findOne({ where: { stripeSubscriptionId } });
  }

  async upsertForCustomer(input: {
    customerId: string; // StripeCustomer.id (UUID FK)
    stripeSubscriptionId: string;
    status: StripeSubscription['status'];
    priceId?: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }) {
    let sub = await this.findByStripeSubscriptionId(input.stripeSubscriptionId);
    if (!sub) {
      sub = this.repo.create({
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeCustomerId: input.customerId,
        status: input.status,
        priceId: input.priceId ?? null,
        cancelAtPeriodEnd: !!input.cancelAtPeriodEnd,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      });
    } else {
      sub.status = input.status;
      sub.priceId = input.priceId ?? sub.priceId;
      if (typeof input.cancelAtPeriodEnd !== 'undefined') {
        sub.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
      }
      sub.currentPeriodStart =
        input.currentPeriodStart ?? sub.currentPeriodStart;
      sub.currentPeriodEnd = input.currentPeriodEnd ?? sub.currentPeriodEnd;
    }
    return this.repo.save(sub);
  }
}
