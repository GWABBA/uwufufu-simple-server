import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeCustomer } from '../entities/stripe-customer.entity';

// src/modules/stripe/repositories/stripe-customers.repository.ts
@Injectable()
export class StripeCustomersRepository {
  constructor(
    @InjectRepository(StripeCustomer)
    private readonly repo: Repository<StripeCustomer>,
  ) {}

  findByStripeCustomerId(stripeCustomerId: string) {
    return this.repo.findOne({ where: { stripeCustomerId } });
  }

  // ✅ userId is INT in DB, so accept number here
  findByUserId(userId: number) {
    return this.repo.findOne({ where: { userId } });
  }

  async upsertByStripeCustomerId(input: {
    stripeCustomerId: string;
    email?: string | null;
    userId?: number | null;
  }) {
    const existing = await this.findByStripeCustomerId(input.stripeCustomerId);
    if (existing) {
      existing.email = input.email ?? existing.email;
      if (typeof input.userId !== 'undefined') existing.userId = input.userId;
      return this.repo.save(existing);
    }
    const created = this.repo.create({
      stripeCustomerId: input.stripeCustomerId,
      email: input.email ?? null,
      userId: typeof input.userId === 'number' ? input.userId : null,
    });
    return this.repo.save(created);
  }
}
