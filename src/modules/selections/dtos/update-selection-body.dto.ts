import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

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
  @IsOptional()
  resourceUrl: string;

  @IsString()
  @IsOptional()
  videoUrl: string;

  @IsNumber()
  @IsOptional()
  startTime: number;

  @IsNumber()
  @IsOptional()
  endTime: number;
}
