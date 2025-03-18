import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AuthLoginBodyDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8)
  @MaxLength(50)
  password: string;
}
