import { Module } from '@nestjs/common';
import { StartedGamesController } from './started-games.controller';
import { StartedGamesService } from './started-games.service';
import { StartedGamesRepository } from './started-games.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartedGame } from './entities/started-game.entity';
import { Game } from '../games/entities/game.entity';
import { GamesRepository } from '../games/games.repository';
import { SelectionsRepository } from '../selections/selections.repository';
import { Match } from './entities/match.entity';
// import { Round } from './entities/round.entity';
import { MatchesRepository } from './matches.repository';
// import { RoundsRepository } from './rounds.repository';

@Module({
  imports: [TypeOrmModule.forFeature([StartedGame, Game, Match])],
  controllers: [StartedGamesController],
  providers: [
    StartedGamesService,
    StartedGamesRepository,
    GamesRepository,
    SelectionsRepository,
    MatchesRepository,
  ],
  exports: [StartedGamesService, StartedGamesRepository],
})
export class StartedGamesModule {}
