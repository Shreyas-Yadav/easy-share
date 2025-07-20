import { Redis } from '@upstash/redis';
import type { ICacheRepository } from '../types/repositories';
import { RepositoryError } from '../types/repositories';

export class RedisCacheRepository implements ICacheRepository {
  private readonly CACHE_PREFIX = 'cache:';
  
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.set(cacheKey, serializedValue, { ex: ttlSeconds });
      } else {
        await this.redis.set(cacheKey, serializedValue);
      }
    } catch (error) {
      throw new RepositoryError(`Failed to set cache value: ${error}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const value = await this.redis.get(cacheKey);
      
      if (value === null || value === undefined) {
        return null;
      }
      
      return JSON.parse(value as string) as T;
    } catch (error) {
      throw new RepositoryError(`Failed to get cache value: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      await this.redis.del(cacheKey);
    } catch (error) {
      throw new RepositoryError(`Failed to delete cache value: ${error}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      throw new RepositoryError(`Failed to check cache existence: ${error}`);
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      await this.redis.expire(cacheKey, ttlSeconds);
    } catch (error) {
      throw new RepositoryError(`Failed to set cache expiration: ${error}`);
    }
  }

  async increment(key: string): Promise<number> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await this.redis.incr(cacheKey);
      return result;
    } catch (error) {
      throw new RepositoryError(`Failed to increment cache value: ${error}`);
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await this.redis.decr(cacheKey);
      return result;
    } catch (error) {
      throw new RepositoryError(`Failed to decrement cache value: ${error}`);
    }
  }

  // Additional utility methods
  async setMultiple(entries: Record<string, any>, ttlSeconds?: number): Promise<void> {
    try {
      // Use individual operations instead of pipeline to avoid parsing issues
      const promises = [];
      
      for (const [key, value] of Object.entries(entries)) {
        const cacheKey = this.getCacheKey(key);
        const serializedValue = JSON.stringify(value);
        
        if (ttlSeconds) {
          promises.push(this.redis.set(cacheKey, serializedValue, { ex: ttlSeconds }));
        } else {
          promises.push(this.redis.set(cacheKey, serializedValue));
        }
      }
      
      await Promise.all(promises);
    } catch (error) {
      throw new RepositoryError(`Failed to set multiple cache values: ${error}`);
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const cacheKeys = keys.map(key => this.getCacheKey(key));
      const values = await this.redis.mget(...cacheKeys);
      
      const result: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const value = values[index];
        result[key] = value ? JSON.parse(value as string) as T : null;
      });
      
      return result;
    } catch (error) {
      throw new RepositoryError(`Failed to get multiple cache values: ${error}`);
    }
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      const cacheKeys = keys.map(key => this.getCacheKey(key));
      await this.redis.del(...cacheKeys);
    } catch (error) {
      throw new RepositoryError(`Failed to delete multiple cache values: ${error}`);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      // Note: This is not efficient for large datasets
      // In production, consider using Redis SCAN command with cursor
      const searchPattern = this.getCacheKey(pattern);
      const keys = await this.redis.keys(searchPattern);
      
      if (keys && keys.length > 0) {
        await this.redis.del(...(keys as string[]));
      }
    } catch (error) {
      throw new RepositoryError(`Failed to delete cache values by pattern: ${error}`);
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      const cacheKey = this.getCacheKey(key);
      const ttl = await this.redis.ttl(cacheKey);
      return ttl;
    } catch (error) {
      throw new RepositoryError(`Failed to get cache TTL: ${error}`);
    }
  }

  async setIfNotExists(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const serializedValue = JSON.stringify(value);
      
      let result;
      if (ttlSeconds) {
        result = await this.redis.set(cacheKey, serializedValue, { ex: ttlSeconds, nx: true });
      } else {
        result = await this.redis.set(cacheKey, serializedValue, { nx: true });
      }
      
      return result === 'OK';
    } catch (error) {
      throw new RepositoryError(`Failed to set cache value if not exists: ${error}`);
    }
  }

  private getCacheKey(key: string): string {
    return `${this.CACHE_PREFIX}${key}`;
  }
} 