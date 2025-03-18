import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { StartedGame } from './entities/started-game.entity';

@Injectable()
export class StartedGamesRepository extends Repository<StartedGame> {
  constructor(private dataSource: DataSource) {
    super(StartedGame, dataSource.createEntityManager());
  }

  // async findByName(name: string): Promise<StartedGame[]> {
  //   return this.createQueryBuilder('startedGame')
  //     .where('startedGame.name = :name', { name })
  //     .getMany();
  // }
}
