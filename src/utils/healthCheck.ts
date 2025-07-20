import { Redis } from '@upstash/redis';
import { RepositoryFactory } from '../factories/RepositoryFactory';
import { ServiceFactory } from '../factories/ServiceFactory';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    redis: ServiceHealth;
    repositories: ServiceHealth;
    services: ServiceHealth;
  };
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

export class HealthChecker {
  private startTime = Date.now();

  constructor(
    private readonly redis: Redis,
    private readonly repositoryFactory: RepositoryFactory,
    private readonly serviceFactory: ServiceFactory
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    const [redisHealth, repositoriesHealth, servicesHealth] = await Promise.allSettled([
      this.checkRedisHealth(),
      this.checkRepositoriesHealth(),
      this.checkServicesHealth(),
    ]);

    const getResult = (result: PromiseSettledResult<ServiceHealth>): ServiceHealth => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        status: 'unhealthy',
        error: result.reason?.message || 'Unknown error',
        lastCheck: timestamp,
      };
    };

    const services = {
      redis: getResult(redisHealth),
      repositories: getResult(repositoriesHealth),
      services: getResult(servicesHealth),
    };

    // Determine overall status
    const allStatuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';

    if (allStatuses.every(s => s === 'healthy')) {
      overallStatus = 'healthy';
    } else if (allStatuses.some(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp,
      services,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  private async checkRedisHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Test basic Redis operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'test';
      
      await this.redis.set(testKey, testValue, { ex: 10 });
      const retrieved = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (retrieved !== testValue) {
        throw new Error('Redis value mismatch');
      }

      const responseTime = Date.now() - start;

      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        responseTime: Date.now() - start,
        lastCheck: timestamp,
      };
    }
  }

  private async checkRepositoriesHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Test repository operations
      const roomRepository = this.repositoryFactory.createRoomRepository();
      const messageRepository = this.repositoryFactory.createMessageRepository();
      const userSessionRepository = this.repositoryFactory.createUserSessionRepository();
      const cacheRepository = this.repositoryFactory.createCacheRepository();

      // Test each repository with lightweight operations
      await Promise.all([
        roomRepository.findActiveRooms(),
        messageRepository.getMessageCount('health_check_room'),
        userSessionRepository.getAllActiveUsers(),
        cacheRepository.exists('health_check_key'),
      ]);

      const responseTime = Date.now() - start;

      return {
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        responseTime: Date.now() - start,
        lastCheck: timestamp,
      };
    }
  }

  private async checkServicesHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Test service operations
      const roomService = this.serviceFactory.createRoomService();
      const messageService = this.serviceFactory.createMessageService();
      const userSessionService = this.serviceFactory.createUserSessionService();

      // Test each service with lightweight operations
      await Promise.all([
        roomService.getActiveRooms(),
        userSessionService.getAllActiveUsers(),
        userSessionService.getUserStats(),
      ]);

      const responseTime = Date.now() - start;

      return {
        status: responseTime < 3000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        responseTime: Date.now() - start,
        lastCheck: timestamp,
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }

  async getQuickStatus(): Promise<'healthy' | 'unhealthy'> {
    try {
      // Quick Redis ping
      await this.redis.ping();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }
} 