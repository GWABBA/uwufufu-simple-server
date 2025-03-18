import { IsInt, IsPositive } from 'class-validator';
import { IsPowerOfTwo } from 'src/core/validations/is-power-of-two.validation';

export class CreateStartedGameDto {
  @IsInt()
  @IsPositive()
  readonly gameId: number;

  @IsInt()
  @IsPositive()
  @IsPowerOfTwo()
  readonly roundsOf: number;
}
