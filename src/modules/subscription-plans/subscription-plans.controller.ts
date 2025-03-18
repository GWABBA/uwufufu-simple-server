import { Controller, Get } from '@nestjs/common';
import { SubscriptionPlansResponseDto } from './dtos/subscription-plans-response.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  async getPlans(): Promise<SubscriptionPlansResponseDto[]> {
    return this.subscriptionPlansService.getPlans();
  }
}
