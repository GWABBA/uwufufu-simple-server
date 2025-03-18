import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Match } from './entities/match.entity';

@Injectable()
export class MatchesRepository extends Repository<Match> {
  constructor(private dataSource: DataSource) {
    super(Match, dataSource.createEntityManager());
  }

  // async findByName(name: string): Promise<StartedGame[]> {
  //   return this.createQueryBuilder('startedGame')
  //     .where('startedGame.name = :name', { name })
  //     .getMany();
  // }
}
