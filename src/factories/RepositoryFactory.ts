import { Redis } from '@upstash/redis';
import type { IRepositoryFactory, IRoomRepository, IMessageRepository, IUserSessionRepository, ICacheRepository } from '../types/repositories';
import { RedisRoomRepository } from '../repositories/RedisRoomRepository';
import { RedisMessageRepository } from '../repositories/RedisMessageRepository';
import { RedisUserSessionRepository } from '../repositories/RedisUserSessionRepository';
import { RedisCacheRepository } from '../repositories/RedisCacheRepository';

export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory;
  
  private roomRepository?: IRoomRepository;
  private messageRepository?: IMessageRepository;
  private userSessionRepository?: IUserSessionRepository;
  private cacheRepository?: ICacheRepository;

  constructor(private readonly redis: Redis) {}

  // Singleton pattern to ensure single instance
  public static getInstance(redis: Redis): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory(redis);
    }
    return RepositoryFactory.instance;
  }

  createRoomRepository(): IRoomRepository {
    if (!this.roomRepository) {
      this.roomRepository = new RedisRoomRepository(this.redis);
    }
    return this.roomRepository;
  }

  createMessageRepository(): IMessageRepository {
    if (!this.messageRepository) {
      this.messageRepository = new RedisMessageRepository(this.redis);
    }
    return this.messageRepository;
  }

  createUserSessionRepository(): IUserSessionRepository {
    if (!this.userSessionRepository) {
      this.userSessionRepository = new RedisUserSessionRepository(this.redis);
    }
    return this.userSessionRepository;
  }

  createCacheRepository(): ICacheRepository {
    if (!this.cacheRepository) {
      this.cacheRepository = new RedisCacheRepository(this.redis);
    }
    return this.cacheRepository;
  }

  // Clean shutdown method
  public dispose(): void {
    this.roomRepository = undefined;
    this.messageRepository = undefined;
    this.userSessionRepository = undefined;
    this.cacheRepository = undefined;
  }
} 