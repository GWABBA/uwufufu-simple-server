import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class Game {
  @Expose()
  slug: string;

  @Expose()
  title: string;

  @Expose()
  description: string;
}

@Exclude()
export class StartedGameResultResponseDto {
  @Expose()
  startedGameId: number;

  @Expose()
  resultImage: string;

  @Expose()
  status: string;

  @Expose()
  @Type(() => Game)
  game: Game;

  @Expose()
  roundsOf: number;

  @Expose()
  createdAt: Date;
}
