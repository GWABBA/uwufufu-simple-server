import { Exclude, Expose, Type } from 'class-transformer';
import { GameResponseDto } from 'src/modules/games/dtos/game-response.dto';

@Exclude()
export class StartedGameWithGameDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => GameResponseDto)
  game: GameResponseDto;

  @Expose()
  roundsOf: number;

  @Expose()
  status: string;

  @Expose()
  createdAt: Date;
}