import { Redis } from '@upstash/redis';
import type { IRepositoryFactory, IRoomRepository, IMessageRepository, IUserSessionRepository, ICacheRepository, IBillRepository } from '../types/repositories';
import type { IStorageService } from '../types/storage';
import { RedisRoomRepository } from '../repositories/RedisRoomRepository';
import { RedisMessageRepository } from '../repositories/RedisMessageRepository';
import { RedisUserSessionRepository } from '../repositories/RedisUserSessionRepository';
import { RedisCacheRepository } from '../repositories/RedisCacheRepository';
import { RedisBillRepository } from '../repositories/RedisBillRepository';
import { FirebaseStorageService } from '../services/FirebaseStorageService';

export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory;
  
  private roomRepository?: IRoomRepository;
  private messageRepository?: IMessageRepository;
  private userSessionRepository?: IUserSessionRepository;
  private cacheRepository?: ICacheRepository;
  private billRepository?: IBillRepository;
  private storageService?: IStorageService;

  constructor(private readonly redis: Redis) {}

  // Singleton pattern to ensure single instance
  public static getInstance(redis: Redis): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory(redis);
    }
    return RepositoryFactory.instance;
  }

  public createRoomRepository(): IRoomRepository {
    if (!this.roomRepository) {
      this.roomRepository = new RedisRoomRepository(this.redis);
    }
    return this.roomRepository;
  }

  public createMessageRepository(): IMessageRepository {
    if (!this.messageRepository) {
      this.messageRepository = new RedisMessageRepository(this.redis);
    }
    return this.messageRepository;
  }

  public createUserSessionRepository(): IUserSessionRepository {
    if (!this.userSessionRepository) {
      this.userSessionRepository = new RedisUserSessionRepository(this.redis);
    }
    return this.userSessionRepository;
  }

  public createCacheRepository(): ICacheRepository {
    if (!this.cacheRepository) {
      this.cacheRepository = new RedisCacheRepository(this.redis);
    }
    return this.cacheRepository;
  }

  public createBillRepository(): IBillRepository {
    if (!this.billRepository) {
      this.billRepository = new RedisBillRepository(this.redis);
    }
    return this.billRepository;
  }

  public createStorageService(): IStorageService {
    if (!this.storageService) {
      this.storageService = new FirebaseStorageService();
    }
    return this.storageService;
  }

  // Cleanup method to reset instances if needed
  public dispose(): void {
    this.roomRepository = undefined;
    this.messageRepository = undefined;
    this.userSessionRepository = undefined;
    this.cacheRepository = undefined;
    this.billRepository = undefined;
    this.storageService = undefined;
  }
} 