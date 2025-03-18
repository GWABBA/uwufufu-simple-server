import { IsNumber, IsPositive } from 'class-validator';

export class CreatePickDto {
  @IsNumber()
  @IsPositive()
  startedGameId: number;

  @IsNumber()
  @IsPositive()
  matchId: number;

  @IsNumber()
  @IsPositive()
  pickedSelectionId: number;
}
