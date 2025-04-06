import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis | Cluster;

  constructor(@Inject('REDIS_CLIENT') redisClient: Redis | Cluster) {
    this.redis = redisClient;
  }

  private async withTimeout<T>(promise: Promise<T>, ms = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Redis timeout')), ms);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delay = 200,
  ): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries) throw err;
        this.logger.warn(
          `[Redis Retry] Attempt ${i + 1} failed: ${err.message}`,
        );
        await new Promise((res) => setTimeout(res, delay * (i + 1)));
      }
    }
    throw new Error('Redis operation failed after retries');
  }

  async setValue(key: string, value: string, ttl?: number) {
    try {
      await this.withRetry(() =>
        this.withTimeout(this.redis.set(key, value), 1000),
      );
      if (ttl) {
        await this.withRetry(() =>
          this.withTimeout(this.redis.expire(key, ttl), 1000),
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error setting key ${key}:`, error);
    }
  }

  async getValue(key: string) {
    try {
      return await this.withRetry(() =>
        this.withTimeout(this.redis.get(key), 1000),
      );
    } catch (error) {
      this.logger.error(`❌ Error getting key ${key}:`, error);
      return null;
    }
  }

  async deleteKey(key: string) {
    try {
      await this.withRetry(() => this.withTimeout(this.redis.del(key), 1000));
    } catch (error) {
      this.logger.error(`❌ Error deleting key ${key}:`, error);
    }
  }

  async deleteByPattern(pattern: string) {
    try {
      const keys = await this.withRetry(() =>
        this.withTimeout(this.redis.keys(pattern), 2000),
      );
      if (keys.length > 0) {
        await this.withRetry(() =>
          this.withTimeout(this.redis.del(...keys), 2000),
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error deleting cache by pattern ${pattern}:`,
        error,
      );
    }
  }

  async deleteKeysByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keysToDelete] = await this.withRetry(() =>
          this.withTimeout(
            this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
            2000,
          ),
        );
        cursor = nextCursor;

        if (keysToDelete.length > 0) {
          await this.withRetry(() =>
            this.withTimeout(this.redis.del(...keysToDelete), 2000),
          );
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(`❌ Error deleting keys by pattern ${pattern}:`, error);
    }
  }
}
