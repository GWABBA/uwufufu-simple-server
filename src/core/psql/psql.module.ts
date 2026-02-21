import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
        console.log('   Synchronize:', configService.get<string>('psql.sync'));
        console.log('   SSL:', sslCert ? 'Enabled' : 'Disabled');

        return {
          type: 'postgres',
          host: configService.get<string>('psql.host'),
          port: configService.get<number>('psql.port'),
          username: configService.get<string>('psql.userName'),
          password: configService.get<string>('psql.password'),
          database: configService.get<string>('psql.databaseName'),
          // entities: [
          //   Game,
          //   User,
          //   Selection,
          //   Category,
          //   EmailToken,
          //   PasswordReset,
          //   Match,
          //   StartedGame,
          //   SubscriptionPlan,
          //   AdminUser,
          //   Payment,
          //   Report,
          // ],
          autoLoadEntities: true,
          synchronize: configService.get<boolean>('psql.sync'),
          ssl: configService.get<string>('psql.ssl')
            ? sslCert
              ? { rejectUnauthorized: true, ca: sslCert }
              : { rejectUnauthorized: false }
            : false,
          extra: {
            max: 50, // 🔥 커넥션 풀 크기
            connectionTimeoutMillis: 3000, // 3초 이상 못 얻으면 에러
            idleTimeoutMillis: 10000,
          },
        };
      },
    }),
  ],
})
export class PSQLModule {}
