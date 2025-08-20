import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentRepository extends Repository<Payment> {
  constructor(private dataSource: DataSource) {
    super(Payment, dataSource.createEntityManager());
  }

  async createPayment(data: Partial<Payment>): Promise<Payment> {
    const payment = this.create(data);
    return this.save(payment);
  }

  // ✅ New: update by subscriptionId (use this for lifecycle status changes)
  async updatePaymentStatusBySubscriptionId(
    subscriptionId: string,
    status: string,
  ): Promise<void> {
    await this.update({ subscriptionId }, { status });
  }

  // ✅ Optional: update by saleId (rare, but handy if you ever need it)
  async updatePaymentStatusBySaleId(
    saleId: string,
    status: string,
  ): Promise<void> {
    await this.update({ saleId }, { status });
  }

  // ✅ Optional helpers (nice to have)
  async findBySubscriptionId(subscriptionId: string): Promise<Payment | null> {
    return this.findOne({ where: { subscriptionId } });
  }

  async findBySaleId(saleId: string): Promise<Payment | null> {
    return this.findOne({ where: { saleId } });
  }
}
