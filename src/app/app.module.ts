import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { IndexModule } from 'src/modules/index.module';
import { PSQLModule } from 'src/core/psql/psql.module';
import appConfig from 'src/config/app.config';
import r2Config from 'src/config/r2.config';
import { RedisModule } from 'src/core/redis/redis.module';
import redisConfig from 'src/config/redis.config';
import psqlConfig from 'src/config/psql.config';
import postmarkConfig from 'src/config/postmark.config';
import { EmailModule } from 'src/core/email/email.module';
import { EmailTokensModule } from 'src/modules/email-tokens/email-tokens.module';
import paypalConfig from 'src/config/paypal.config';
import discordConfig from 'src/config/discord.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        r2Config,
        redisConfig,
        psqlConfig,
        postmarkConfig,
        paypalConfig,
        discordConfig,
      ],
    }),
    PSQLModule,
    IndexModule,
    RedisModule,
    EmailModule,
    EmailTokensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
