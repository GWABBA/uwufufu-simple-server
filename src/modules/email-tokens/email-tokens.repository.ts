import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmailToken } from './entities/email-token.entity';

@Injectable()
export class EmailTokensRepository extends Repository<EmailToken> {
  constructor(private dataSource: DataSource) {
    super(EmailToken, dataSource.createEntityManager());
  }
}
