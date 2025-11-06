import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmailToken, EmailTokenPurpose } from './entities/email-token.entity';

@Injectable()
export class EmailTokensRepository extends Repository<EmailToken> {
  constructor(private dataSource: DataSource) {
    super(EmailToken, dataSource.createEntityManager());
  }

  countForUserSince(userId: number, purpose: EmailTokenPurpose, since: Date) {
    return this.createQueryBuilder('t')
      .select('COUNT(1)', 'cnt')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.purpose = :purpose', { purpose })
      .andWhere('t.createdAt >= :since', { since })
      .getRawOne()
      .then((r) => Number(r?.cnt ?? 0));
  }
}
