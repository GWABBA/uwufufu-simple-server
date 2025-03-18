import { Module } from '@nestjs/common';
import { EmailTokensRepository } from './email-tokens.repository';
import { EmailToken } from './entities/email-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmailToken]), UsersModule],
  providers: [EmailTokensRepository],
  exports: [EmailTokensRepository],
})
export class EmailTokensModule {}
