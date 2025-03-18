import { PasswordResetRepository } from './../password-reset/password-reset.repository';
import { AuthService } from './auth.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/core/passport/jwt.strategy';
import { EmailModule } from 'src/core/email/email.module';
import { EmailTokensModule } from '../email-tokens/email-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    EmailModule,
    EmailTokensModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    PasswordResetRepository,
    JwtStrategy,
  ],
  exports: [AuthService, UsersRepository],
})
export class AuthModule {}
