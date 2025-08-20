import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

import { StripeCustomer } from './entities/stripe-customer.entity';
import { StripeSubscription } from './entities/stripe-subscription.entity';

import { StripeCustomersRepository } from './repositories/stripe-customers.repository';
import { StripeSubscriptionsRepository } from './repositories/stripe-subscriptions.repository';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StripeCustomer, StripeSubscription, User]),
  ],
  controllers: [StripeController],
  providers: [
    StripeService,
    StripeCustomersRepository,
    StripeSubscriptionsRepository,
  ],
  exports: [
    StripeService,
    StripeCustomersRepository,
    StripeSubscriptionsRepository,
  ],
})
export class StripeModule {}
