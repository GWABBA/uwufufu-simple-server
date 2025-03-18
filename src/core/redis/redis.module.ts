import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host', 'localhost');
        const redisPort = configService.get<number>('redis.port', 6379);
        const useTls = configService.get<string>('redis.tls') === 'true';
        const isClusterMode =
          configService.get<string>('redis.cluster') === 'true';

        console.log(
          'Redis Host:',
          redisHost,
          'Redis Port:',
          redisPort,
          'Use TLS:',
          useTls,
          'Is Cluster Mode:',
          isClusterMode,
        );
        console.log(
          `🛠️ Connecting to ${isClusterMode ? 'Redis Cluster' : 'Standalone Redis'}`,
        );

        if (isClusterMode) {
          return new Redis.Cluster(
            [
              {
                host: redisHost, // AWS ElastiCache Cluster Endpoint
                port: redisPort,
                ...(useTls ? { tls: {} } : {}), // Enable TLS for AWS
              },
            ],
            {
              scaleReads: 'all',
            },
          );
        } else {
          return new Redis({
            host: redisHost, // Local Redis or Single-instance ElastiCache
            port: redisPort,
            ...(useTls ? { tls: {} } : {}),
          });
        }
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
