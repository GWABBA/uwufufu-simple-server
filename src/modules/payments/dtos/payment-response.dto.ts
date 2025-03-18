import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaymentResponseDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  amount: number;

  @Expose()
  currency: string;

  @Expose()
  status: string;

  @Expose()
  createdAt: Date;
}
