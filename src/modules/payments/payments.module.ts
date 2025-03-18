import { Module } from '@nestjs/common';
import { PaypalWebhookController } from './paypal-webhook.controller';
import { PaypalWebhookService } from './paypal-webhook.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRepository } from './payments.repository';
import { Payment } from './entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, User]), UsersModule],
  controllers: [PaypalWebhookController, PaymentsController],
  providers: [PaypalWebhookService, PaymentRepository, PaymentsService],
})
export class PaymentsModule {}
