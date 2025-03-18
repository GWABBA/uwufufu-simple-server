import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateSelectionWithVideoBodyDto {
  @IsNumber()
  @IsPositive()
  worldcupId: number;

  @IsString()
  @IsNotEmpty()
  resourceUrl: string;

  @IsNumber()
  startTime: number;

  @IsNumber()
  endTime: number;
}
