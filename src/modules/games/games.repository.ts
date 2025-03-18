import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Game } from './entities/game.entity';

@Injectable()
export class GamesRepository extends Repository<Game> {
  constructor(private dataSource: DataSource) {
    super(Game, dataSource.createEntityManager());
  }
}
