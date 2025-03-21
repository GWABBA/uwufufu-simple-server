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
    return await this.save(payment);
  }

  async updatePaymentStatus(
    paypalOrderId: string,
    status: string,
  ): Promise<void> {
    await this.update({ paypalOrderId }, { status });
  }
}
