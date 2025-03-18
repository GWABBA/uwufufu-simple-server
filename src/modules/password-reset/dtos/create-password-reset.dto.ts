import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreatePasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
