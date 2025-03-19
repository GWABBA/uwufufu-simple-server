import { Optional } from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class UpdateSelectionBodyDto {
  @IsNumber()
  @IsPositive()
  gameId: number;

  @IsNumber()
  @IsPositive()
  selectionId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Optional()
  resourceUrl: string;
}
