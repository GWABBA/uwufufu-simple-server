import { Selection } from './entities/selection.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class SelectionsRepository extends Repository<Selection> {
  constructor(private dataSource: DataSource) {
    super(Selection, dataSource.createEntityManager());
  }
}
