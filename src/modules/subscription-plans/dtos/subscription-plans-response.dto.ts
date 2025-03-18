import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SubscriptionPlansResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  price: number;

  @Expose()
  billingCycle: string;

  @Expose()
  description: string;
}
