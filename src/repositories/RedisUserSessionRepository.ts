import { Redis } from '@upstash/redis';
import type { SocketData } from '../types/room';
import type { IUserSessionRepository } from '../types/repositories';
import { RepositoryError } from '../types/repositories';

export class RedisUserSessionRepository implements IUserSessionRepository {
  private readonly USER_SOCKET_PREFIX = 'user_socket:';
  private readonly SOCKET_DATA_PREFIX = 'socket_data:';
  private readonly ACTIVE_USERS_KEY = 'active_users';
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  
  constructor(private readonly redis: Redis) {}

  async setUserSocket(userId: string, socketId: string): Promise<void> {
    try {
      const userSocketKey = this.getUserSocketKey(userId);
      
      // Store user -> socket mapping
      await this.redis.set(userSocketKey, socketId, { ex: this.SESSION_TTL });
      
      // Add to active users set
      await this.redis.sadd(this.ACTIVE_USERS_KEY, userId);
      await this.redis.expire(this.ACTIVE_USERS_KEY, this.SESSION_TTL);
    } catch (error) {
      throw new RepositoryError(`Failed to set user socket: ${error}`);
    }
  }

  async getUserSocket(userId: string): Promise<string | null> {
    try {
      const userSocketKey = this.getUserSocketKey(userId);
      const socketId = await this.redis.get(userSocketKey);
      return socketId as string | null;
    } catch (error) {
      throw new RepositoryError(`Failed to get user socket: ${error}`);
    }
  }

  async removeUserSocket(userId: string): Promise<void> {
    try {
      const userSocketKey = this.getUserSocketKey(userId);
      
      // Remove user -> socket mapping
      await this.redis.del(userSocketKey);
      
      // Remove from active users set
      await this.redis.srem(this.ACTIVE_USERS_KEY, userId);
    } catch (error) {
      throw new RepositoryError(`Failed to remove user socket: ${error}`);
    }
  }

  async setSocketData(socketId: string, userData: SocketData): Promise<void> {
    try {
      const socketDataKey = this.getSocketDataKey(socketId);
      
      // Store socket -> userData mapping
      await this.redis.set(socketDataKey, this.serializeSocketData(userData), { 
        ex: this.SESSION_TTL 
      });
    } catch (error) {
      throw new RepositoryError(`Failed to set socket data: ${error}`);
    }
  }

  async getSocketData(socketId: string): Promise<SocketData | null> {
    try {
      const socketDataKey = this.getSocketDataKey(socketId);
      const userData = await this.redis.get(socketDataKey);
      
      if (!userData) return null;
      
      return this.deserializeSocketData(userData);
    } catch (error) {
      throw new RepositoryError(`Failed to get socket data: ${error}`);
    }
  }

  async removeSocketData(socketId: string): Promise<void> {
    try {
      const socketDataKey = this.getSocketDataKey(socketId);
      await this.redis.del(socketDataKey);
    } catch (error) {
      throw new RepositoryError(`Failed to remove socket data: ${error}`);
    }
  }

  async getAllActiveUsers(): Promise<SocketData[]> {
    try {
      const activeUserIds = await this.redis.smembers(this.ACTIVE_USERS_KEY);
      
      if (!activeUserIds || activeUserIds.length === 0) {
        return [];
      }
      
      const activeUsers: SocketData[] = [];
      
      // Get socket IDs for all active users
      for (const userId of activeUserIds as string[]) {
        const socketId = await this.getUserSocket(userId);
        if (socketId) {
          const userData = await this.getSocketData(socketId);
          if (userData) {
            activeUsers.push(userData);
          }
        }
      }
      
      return activeUsers;
    } catch (error) {
      throw new RepositoryError(`Failed to get all active users: ${error}`);
    }
  }

  // Additional utility methods
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const socketId = await this.getUserSocket(userId);
      return socketId !== null;
    } catch (error) {
      throw new RepositoryError(`Failed to check if user is online: ${error}`);
    }
  }

  async getUsersInRoom(roomId: string): Promise<SocketData[]> {
    try {
      const activeUsers = await this.getAllActiveUsers();
      return activeUsers.filter(user => user.roomId === roomId);
    } catch (error) {
      throw new RepositoryError(`Failed to get users in room: ${error}`);
    }
  }

  async updateUserRoom(userId: string, roomId: string | undefined): Promise<void> {
    try {
      const socketId = await this.getUserSocket(userId);
      if (!socketId) return;
      
      const userData = await this.getSocketData(socketId);
      if (!userData) return;
      
      userData.roomId = roomId;
      await this.setSocketData(socketId, userData);
    } catch (error) {
      throw new RepositoryError(`Failed to update user room: ${error}`);
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const activeUserIds = await this.redis.smembers(this.ACTIVE_USERS_KEY);
      
      if (!activeUserIds || activeUserIds.length === 0) {
        return;
      }
      
      // Check each user's socket and remove expired ones
      for (const userId of activeUserIds as string[]) {
        const socketId = await this.getUserSocket(userId);
        if (!socketId) {
          // User socket expired, remove from active users
          await this.redis.srem(this.ACTIVE_USERS_KEY, userId);
        } else {
          // Check if socket data exists
          const userData = await this.getSocketData(socketId);
          if (!userData) {
            // Socket data expired, cleanup user session
            await this.removeUserSocket(userId);
          }
        }
      }
    } catch (error) {
      throw new RepositoryError(`Failed to cleanup expired sessions: ${error}`);
    }
  }

  private getUserSocketKey(userId: string): string {
    return `${this.USER_SOCKET_PREFIX}${userId}`;
  }

  private getSocketDataKey(socketId: string): string {
    return `${this.SOCKET_DATA_PREFIX}${socketId}`;
  }

  private serializeSocketData(data: SocketData): string {
    return JSON.stringify(data);
  }

  private deserializeSocketData(data: any): SocketData { // eslint-disable-line @typescript-eslint/no-explicit-any
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  /**
   * Remove all socket_data keys that belong to a specific user
   * This is useful for comprehensive user logout cleanup
   */
     async removeAllSocketDataForUser(userId: string): Promise<number> {
     try {
       let removedCount = 0;
       let cursor: string | number = 0;
       
       do {
         const result = await this.redis.scan(cursor, {
           match: `${this.SOCKET_DATA_PREFIX}*`,
           count: 100
         }) as [string | number, string[]];
         
         cursor = result[0];
         const keys = result[1];
        
        // Check each socket_data key
        for (const key of keys) {
          try {
            const data = await this.redis.get(key);
            if (data) {
              const socketData = this.deserializeSocketData(data);
              if (socketData.userId === userId) {
                await this.redis.del(key);
                removedCount++;
                console.log(`Removed socket data: ${key} for user: ${userId}`);
              }
            }
          } catch (error) {
            console.error(`Error processing socket data key ${key}:`, error);
          }
        }
      } while (cursor !== 0);
      
      if (removedCount > 0) {
        console.log(`Total socket_data keys removed for user ${userId}: ${removedCount}`);
      }
      
      return removedCount;
    } catch (error) {
      throw new RepositoryError(`Failed to remove socket data for user ${userId}: ${error}`);
    }
  }
} 