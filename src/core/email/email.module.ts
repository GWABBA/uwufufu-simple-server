import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { EmailTokensModule } from 'src/modules/email-tokens/email-tokens.module';

@Module({
  imports: [ConfigModule, UsersModule, EmailTokensModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
