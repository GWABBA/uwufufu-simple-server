import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSelectionWithImageDto {
  @IsNotEmpty({ message: 'Type is required' })
  @IsString({ message: 'Type must be a string' })
  type: string;

  @IsNotEmpty({ message: 'worldcupId is required' })
  @IsString({ message: 'worldcupId must be a string' })
  worldcupId: string;
}
