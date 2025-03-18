import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis | Cluster; // ✅ Support both

  constructor(@Inject('REDIS_CLIENT') redisClient: Redis | Cluster) {
    this.redis = redisClient;
  }

  async setValue(key: string, value: string, ttl?: number) {
    try {
      await this.redis.set(key, value);
      if (ttl) {
        await this.redis.expire(key, ttl);
      }
    } catch (error) {
      this.logger.error(`❌ Error setting key ${key}:`, error);
    }
  }

  async getValue(key: string) {
    try {
      const value = await this.redis.get(key);
      return value;
    } catch (error) {
      this.logger.error(`❌ Error getting key ${key}:`, error);
      return null;
    }
  }

  async deleteKey(key: string) {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`❌ Error deleting key ${key}:`, error);
    }
  }

  async deleteByPattern(pattern: string) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
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
        const result = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = result[0]; // Next cursor position
        const keysToDelete = result[1]; // Found keys

        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete); // ✅ Batch delete
        }
      } while (cursor !== '0'); // Stop when cursor reaches 0
    } catch (error) {
      this.logger.error(`❌ Error deleting keys by pattern ${pattern}:`, error);
    }
  }
}
