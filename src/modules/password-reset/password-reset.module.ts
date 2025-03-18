import { PasswordReset } from './entities/password-reset.entity';
import { Module } from '@nestjs/common';
import { PasswordResetController } from './password-reset.controller';
import { UsersRepository } from '../users/users.repository';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetRepository } from './password-reset.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/core/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordReset]), EmailModule],
  controllers: [PasswordResetController],
  providers: [UsersRepository, PasswordResetService, PasswordResetRepository],
  exports: [PasswordResetService, PasswordResetRepository],
})
export class PasswordResetModule {}
