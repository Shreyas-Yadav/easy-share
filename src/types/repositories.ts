import type { Room, RoomParticipant, Message, SocketData } from './room';

// Repository interfaces following Interface Segregation Principle
export interface IRoomRepository {
  create(room: Room): Promise<void>;
  findById(id: string): Promise<Room | null>;
  findByCode(code: string): Promise<Room | null>;
  update(room: Room): Promise<void>;
  delete(id: string): Promise<void>;
  findActiveRooms(): Promise<Room[]>;
  addParticipant(roomId: string, participant: RoomParticipant): Promise<void>;
  removeParticipant(roomId: string, userId: string): Promise<void>;
  updateParticipantStatus(roomId: string, userId: string, isOnline: boolean): Promise<void>;
}

export interface IMessageRepository {
  create(message: Message): Promise<void>;
  findByRoomId(roomId: string, limit?: number, offset?: number): Promise<Message[]>;
  findById(id: string): Promise<Message | null>;
  update(message: Message): Promise<void>;
  delete(id: string): Promise<void>;
  getMessageCount(roomId: string): Promise<number>;
}

export interface IUserSessionRepository {
  setUserSocket(userId: string, socketId: string): Promise<void>;
  getUserSocket(userId: string): Promise<string | null>;
  removeUserSocket(userId: string): Promise<void>;
  setSocketData(socketId: string, userData: SocketData): Promise<void>;
  getSocketData(socketId: string): Promise<SocketData | null>;
  removeSocketData(socketId: string): Promise<void>;
  getAllActiveUsers(): Promise<SocketData[]>;
  isUserOnline(userId: string): Promise<boolean>;
  getUsersInRoom(roomId: string): Promise<SocketData[]>;
  updateUserRoom(userId: string, roomId: string | undefined): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

export interface ICacheRepository {
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  increment(key: string): Promise<number>;
  decrement(key: string): Promise<number>;
}

// Repository factory interface for Dependency Inversion
export interface IRepositoryFactory {
  createRoomRepository(): IRoomRepository;
  createMessageRepository(): IMessageRepository;
  createUserSessionRepository(): IUserSessionRepository;
  createCacheRepository(): ICacheRepository;
}

// Error types for repositories
export class RepositoryError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
} 