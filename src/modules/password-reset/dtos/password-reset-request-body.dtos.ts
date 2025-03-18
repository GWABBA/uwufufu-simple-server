import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class PasswordResetRequestBodyDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
