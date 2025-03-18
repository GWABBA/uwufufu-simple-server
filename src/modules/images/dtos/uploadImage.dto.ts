import { IsNotEmpty, IsString } from 'class-validator';

export class UploadImageDto {
  @IsNotEmpty({ message: 'Type is required' })
  @IsString({ message: 'Type must be a string' })
  type: string;
}
