import { Injectable } from '@nestjs/common';
import { SubscriptionPlansRepository } from './subscription-plans.repository';
import { SubscriptionPlansResponseDto } from './dtos/subscription-plans-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly subscriptionPlanRepository: SubscriptionPlansRepository,
  ) {}

  async getPlans(): Promise<SubscriptionPlansResponseDto[]> {
    const plans = await this.subscriptionPlanRepository.find();

    return plainToInstance(SubscriptionPlansResponseDto, plans, {
      excludeExtraneousValues: true,
    });
  }
}
