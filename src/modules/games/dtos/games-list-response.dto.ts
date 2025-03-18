import { Exclude, Expose, Type } from 'class-transformer';
import { GameResponseDto } from './game-response.dto';

@Exclude()
export class GamesListResponseDto {
  @Expose()
  page: number;

  @Expose()
  perPage: number;

  @Expose()
  @Type(() => GameResponseDto)
  worldcups: GameResponseDto[];

  @Expose()
  total: number;
}
