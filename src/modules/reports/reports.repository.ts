import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportsRepository extends Repository<Report> {
  constructor(private dataSource: DataSource) {
    super(Report, dataSource.createEntityManager());
  }
}
