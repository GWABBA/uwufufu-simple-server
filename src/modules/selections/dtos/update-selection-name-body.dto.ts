import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class UpdateSelectionNameBodyDto {
  @IsNumber()
  @IsPositive()
  gameId: number;

  @IsNumber()
  @IsPositive()
  selectionId: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}
