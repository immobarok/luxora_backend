import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient!: Redis;

  onModuleInit() {
    this.redisClient = new Redis(process.env.REDIS_URL || '');
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.set(key, value, 'EX', ttl);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.redisClient.exists(key);
  }

  /**
   * Delete all keys matching a glob pattern using SCAN + DEL.
   * Uses cursor-based SCAN to avoid blocking the Redis server with KEYS.
   *
   * @example await deletePattern('refresh_token:userId:*')
   */
  async deletePattern(pattern: string): Promise<void> {
    let cursor = '0';
    const pipeline = this.redisClient.pipeline();
    let hasDeletes = false;

    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        pipeline.del(...keys);
        hasDeletes = true;
      }
    } while (cursor !== '0');

    if (hasDeletes) {
      await pipeline.exec();
    }
  }
}
