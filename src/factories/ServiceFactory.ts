import type { IRepositoryFactory } from '../types/repositories';
import { RoomService } from '../services/RoomService';
import { MessageService } from '../services/MessageService';
import { UserSessionService } from '../services/UserSessionService';

export class ServiceFactory {
  private static instance: ServiceFactory;
  
  private roomService?: RoomService;
  private messageService?: MessageService;
  private userSessionService?: UserSessionService;

  constructor(private readonly repositoryFactory: IRepositoryFactory) {}

  // Singleton pattern to ensure single instance
  public static getInstance(repositoryFactory: IRepositoryFactory): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(repositoryFactory);
    }
    return ServiceFactory.instance;
  }

  createRoomService(): RoomService {
    if (!this.roomService) {
      const roomRepository = this.repositoryFactory.createRoomRepository();
      const messageRepository = this.repositoryFactory.createMessageRepository();
      const userSessionRepository = this.repositoryFactory.createUserSessionRepository();
      
      this.roomService = new RoomService(
        roomRepository,
        messageRepository,
        userSessionRepository
      );
    }
    return this.roomService;
  }

  createMessageService(): MessageService {
    if (!this.messageService) {
      const messageRepository = this.repositoryFactory.createMessageRepository();
      const roomRepository = this.repositoryFactory.createRoomRepository();
      
      this.messageService = new MessageService(
        messageRepository,
        roomRepository
      );
    }
    return this.messageService;
  }

  createUserSessionService(): UserSessionService {
    if (!this.userSessionService) {
      const userSessionRepository = this.repositoryFactory.createUserSessionRepository();
      const cacheRepository = this.repositoryFactory.createCacheRepository();
      
      this.userSessionService = new UserSessionService(
        userSessionRepository,
        cacheRepository
      );
    }
    return this.userSessionService;
  }

  // Clean shutdown method
  public dispose(): void {
    this.roomService = undefined;
    this.messageService = undefined;
    this.userSessionService = undefined;
  }
} 