import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  isVerified: boolean;

  @Expose()
  profileImage: string;

  @Expose()
  tier: string;

  @Expose()
  subscriptionEndDate: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
