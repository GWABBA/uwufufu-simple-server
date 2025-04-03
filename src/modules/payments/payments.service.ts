import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentRepository } from './payments.repository';
import { UsersRepository } from '../users/users.repository';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { plainToInstance } from 'class-transformer';
import { PaymentResponseDto } from './dtos/payment-response.dto';
import { IsNull, MoreThan } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    private paymentRepository: PaymentRepository,
    private usersRepository: UsersRepository,
    private configService: ConfigService,
  ) {}

  async fetchActiveSubscription(
    userFromToken: UserFromToken,
  ): Promise<PaymentResponseDto | null> {
    const userFromDb = await this.usersRepository.findOne({
      where: { id: userFromToken.userId, deletedAt: IsNull() },
    });

    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }
    // 🔍 Find the latest ACTIVE subscription
    const activeSubscription = await this.paymentRepository.findOne({
      where: {
        user: { id: userFromDb.id },
        status: 'ACTIVE',
      },
      order: { createdAt: 'DESC' },
    });

    if (!activeSubscription) {
      throw new NotFoundException('No active subscription found.');
    }
    // ✅ Transform the result into `PaymentResponseDto`
    return plainToInstance(PaymentResponseDto, activeSubscription, {
      excludeExtraneousValues: true,
    });
  }

  async fetchLatestSubscription(
    userFromToken: UserFromToken,
  ): Promise<PaymentResponseDto | null> {
    // 🔍 Ensure the user exists
    const userFromDb = await this.usersRepository.findOne({
      where: { id: userFromToken.userId, deletedAt: IsNull() },
    });

    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }

    // 🕒 Calculate 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 🔍 Find the latest ACTIVE subscription within 3 months
    const latestSubscription = await this.paymentRepository.findOne({
      where: {
        user: { id: userFromDb.id },
        createdAt: MoreThan(threeMonthsAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (!latestSubscription) {
      throw new NotFoundException('Latest subscription not found'); // throw 404
    }

    // ✅ Transform the result into `PaymentResponseDto`
    return plainToInstance(PaymentResponseDto, latestSubscription, {
      excludeExtraneousValues: true,
    });
  }

  private async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('paypal.clientId');
    const clientSecret = this.configService.get<string>('paypal.clientSecret');

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        'https://api-m.paypal.com/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new HttpException(
        'Failed to get PayPal access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async cancelSubscription(userFromToken: UserFromToken) {
    // 🔍 Ensure the user exists
    const userFromDb = await this.usersRepository.findOne({
      where: { id: userFromToken.userId, deletedAt: IsNull() },
    });

    if (!userFromDb) {
      throw new NotFoundException('User not found');
    }

    // 🔍 Find the latest ACTIVE subscription
    const latestSubscription = await this.paymentRepository.findOne({
      where: {
        user: { id: userFromDb.id },
        status: 'ACTIVE',
      },
      order: { createdAt: 'DESC' },
    });

    if (!latestSubscription) {
      throw new NotFoundException('No active subscription found.');
    }

    const subscriptionId = latestSubscription.paypalOrderId; // ✅ Retrieve PayPal subscription ID
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.post(
        `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`,
        { reason: 'User requested cancellation' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        message: 'Subscription canceled successfully',
        response: response.data,
      };
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Failed to cancel subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
