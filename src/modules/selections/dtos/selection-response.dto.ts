import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SelectionResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  isVideo: boolean;

  @Expose()
  videoSource: string;

  @Expose()
  videoUrl: string;

  @Expose()
  resourceUrl: string;

  @Expose()
  startTime: number;

  @Expose()
  endTime: number;

  @Expose()
  wins: number;

  @Expose()
  losses: number;

  @Expose()
  finalWins: number;

  @Expose()
  finalLosses: number;

  @Expose()
  winLossRatio: number;

  @Expose()
  gameId: number;

  @Expose()
  ranking: number;
}
