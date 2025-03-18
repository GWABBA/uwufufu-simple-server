import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordBodyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
