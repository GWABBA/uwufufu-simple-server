import { Expose, Type } from 'class-transformer';

class Game {
  @Expose()
  id: number;

  @Expose()
  title: string;
}

class StartedGame {
  @Expose()
  id: number;

  @Type(() => Game)
  @Expose()
  game: Game;

  @Expose()
  roundsOf: number;

  @Expose()
  status: string;
}

class Selection {
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
  startTime: number;

  @Expose()
  endTime: number;

  @Expose()
  resourceUrl: string;
}

class Match {
  @Expose()
  id: number;

  @Expose()
  roundsOf: number;

  @Type(() => Selection)
  @Expose()
  selection1: Selection;

  @Type(() => Selection)
  @Expose()
  selection2: Selection;

  @Expose()
  winnerId: number;
}

export class StartedGameResponseDto {
  @Type(() => StartedGame)
  @Expose()
  startedGame: StartedGame;

  @Type(() => Match)
  @Expose()
  previousMatch: Match;

  @Type(() => Match)
  @Expose()
  match: Match;

  @Expose()
  matchNumberInRound: number;
}
