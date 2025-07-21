import type { IRepositoryFactory } from '../types/repositories';
import { RoomService } from '../services/RoomService';
import { MessageService } from '../services/MessageService';
import { UserSessionService } from '../services/UserSessionService';
import { BillService } from '../services/BillService';

export class ServiceFactory {
  private static instance: ServiceFactory;
  
  private roomService?: RoomService;
  private messageService?: MessageService;
  private userSessionService?: UserSessionService;
  private billService?: BillService;

  constructor(private readonly repositoryFactory: IRepositoryFactory) {}

  // Singleton pattern to ensure single instance
  public static getInstance(repositoryFactory: IRepositoryFactory): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(repositoryFactory);
    }
    return ServiceFactory.instance;
  }

  public createRoomService(): RoomService {
    if (!this.roomService) {
      const roomRepository = this.repositoryFactory.createRoomRepository();
      const messageRepository = this.repositoryFactory.createMessageRepository();
      const userSessionRepository = this.repositoryFactory.createUserSessionRepository();
      const messageService = this.createMessageService();
      
      this.roomService = new RoomService(roomRepository, messageRepository, userSessionRepository, messageService);
    }
    return this.roomService;
  }

  public createMessageService(): MessageService {
    if (!this.messageService) {
      const messageRepository = this.repositoryFactory.createMessageRepository();
      const roomRepository = this.repositoryFactory.createRoomRepository();
      const storageService = this.repositoryFactory.createStorageService();
      
      this.messageService = new MessageService(messageRepository, roomRepository, storageService);
    }
    return this.messageService;
  }

  public createUserSessionService(): UserSessionService {
    if (!this.userSessionService) {
      const userSessionRepository = this.repositoryFactory.createUserSessionRepository();
      const cacheRepository = this.repositoryFactory.createCacheRepository();
      
      this.userSessionService = new UserSessionService(userSessionRepository, cacheRepository);
    }
    return this.userSessionService;
  }

  public createBillService(): BillService {
    if (!this.billService) {
      const billRepository = this.repositoryFactory.createBillRepository();
      const roomRepository = this.repositoryFactory.createRoomRepository();
      
      this.billService = new BillService(billRepository, roomRepository);
    }
    return this.billService;
  }

  // Cleanup method to reset instances if needed
  public dispose(): void {
    this.roomService = undefined;
    this.messageService = undefined;
    this.userSessionService = undefined;
    this.billService = undefined;
  }
} 