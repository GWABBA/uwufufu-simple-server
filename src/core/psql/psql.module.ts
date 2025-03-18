import { User } from 'src/modules/users/entities/user.entity';
import { Game } from 'src/modules/games/entities/game.entity';
import { Selection } from 'src/modules/selections/entities/selection.entity';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Category } from 'src/modules/categories/entities/category.entity';
import { EmailToken } from 'src/modules/email-tokens/entities/email-token.entity';
import { PasswordReset } from 'src/modules/password-reset/entities/password-reset.entity';
import { StartedGame } from 'src/modules/started-games/entities/started-game.entity';
import { SubscriptionPlan } from 'src/modules/subscription-plans/entities/subscription-plan.entity';
import { Match } from 'src/modules/started-games/entities/match.entity';
import AdminUser from 'nestjs-admin/dist/src/adminUser/adminUser.entity';
import { Payment } from 'src/modules/payments/entities/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // ✅ Ensure ConfigModule is available
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const sslCertPath = configService.get<string>('DATABASE_SSL_CERT_PATH');
        let sslCert: string | undefined;

        if (sslCertPath) {
          try {
            sslCert = fs.readFileSync(
              path.resolve(__dirname, sslCertPath),
              'utf8',
            );
          } catch (error) {
            console.error('❌ Error reading SSL certificate:', error);
          }
        }

        console.log('🔹 Database Config:');
        console.log('   Host:', configService.get<string>('psql.host'));
        console.log('   Port:', configService.get<number>('psql.port'));
        console.log('   Username:', configService.get<string>('psql.userName'));
        console.log('   SSL:', sslCert ? 'Enabled' : 'Disabled');

        return {
          type: 'postgres',
          host: configService.get<string>('psql.host'),
          port: configService.get<number>('psql.port'),
          username: configService.get<string>('psql.userName'),
          password: configService.get<string>('psql.password'),
          database: configService.get<string>('psql.databaseName'),
          entities: [
            Game,
            User,
            Selection,
            Category,
            EmailToken,
            PasswordReset,
            Match,
            StartedGame,
            SubscriptionPlan,
            AdminUser,
            Payment,
          ],
          synchronize: configService.get<string>('app.env') !== 'production', // ❌ Set false in production
          ssl: configService.get<string>('psql.ssl')
            ? sslCert
              ? { rejectUnauthorized: true, ca: sslCert }
              : { rejectUnauthorized: false }
            : false,
        };
      },
    }),
  ],
})
export class PSQLModule {}
