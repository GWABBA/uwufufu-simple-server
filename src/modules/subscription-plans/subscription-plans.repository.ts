import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlansRepository extends Repository<SubscriptionPlan> {
  constructor(private dataSource: DataSource) {
    super(SubscriptionPlan, dataSource.createEntityManager());
  }
}
