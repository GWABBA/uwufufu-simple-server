import { IsString } from 'class-validator';

export class AuthEmailVerificationDto {
  @IsString()
  token: string;
}
