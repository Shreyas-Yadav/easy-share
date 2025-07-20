import type { SocketData } from '../types/room';
import type { IUserSessionRepository, ICacheRepository } from '../types/repositories';
import { RepositoryError } from '../types/repositories';

export class UserSessionService {
  private readonly TYPING_TTL = 5; // 5 seconds
  private readonly USER_ACTIVITY_TTL = 300; // 5 minutes

  constructor(
    private readonly userSessionRepository: IUserSessionRepository,
    private readonly cacheRepository: ICacheRepository
  ) {}

  async authenticateUser(userData: Omit<SocketData, 'roomId'>, socketId: string): Promise<void> {
    const fullUserData: SocketData = {
      ...userData,
      roomId: undefined,
    };

    // Store socket data
    await this.userSessionRepository.setSocketData(socketId, fullUserData);
    
    // Map user to socket
    await this.userSessionRepository.setUserSocket(userData.userId, socketId);

    // Track user activity
    await this.trackUserActivity(userData.userId);
  }

  async disconnectUser(socketId: string): Promise<void> {
    const userData = await this.userSessionRepository.getSocketData(socketId);
    if (userData) {
      // Remove user socket mapping
      await this.userSessionRepository.removeUserSocket(userData.userId);
      
      // Remove socket data
      await this.userSessionRepository.removeSocketData(socketId);
      
      // Clear typing indicators
      await this.clearUserTyping(userData.userId);
    }
  }

  async getUserBySocketId(socketId: string): Promise<SocketData | null> {
    return this.userSessionRepository.getSocketData(socketId);
  }

  async getSocketByUserId(userId: string): Promise<string | null> {
    return this.userSessionRepository.getUserSocket(userId);
  }

  async updateUserRoom(userId: string, roomId: string | undefined): Promise<void> {
    await this.userSessionRepository.updateUserRoom(userId, roomId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.userSessionRepository.isUserOnline(userId);
  }

  async getAllActiveUsers(): Promise<SocketData[]> {
    return this.userSessionRepository.getAllActiveUsers();
  }

  async getUsersInRoom(roomId: string): Promise<SocketData[]> {
    return this.userSessionRepository.getUsersInRoom(roomId);
  }

  async getOnlineUsersCount(): Promise<number> {
    const activeUsers = await this.getAllActiveUsers();
    return activeUsers.length;
  }

  async getActiveRoomsCount(): Promise<number> {
    const activeUsers = await this.getAllActiveUsers();
    const uniqueRooms = new Set(
      activeUsers
        .filter(user => user.roomId)
        .map(user => user.roomId)
    );
    return uniqueRooms.size;
  }

  // Typing indicator management
  async setUserTyping(userId: string, roomId: string, isTyping: boolean): Promise<void> {
    const typingKey = this.getTypingKey(roomId, userId);
    
    if (isTyping) {
      await this.cacheRepository.set(typingKey, {
        userId,
        roomId,
        timestamp: Date.now(),
      }, this.TYPING_TTL);
    } else {
      await this.cacheRepository.delete(typingKey);
    }
  }

  async getTypingUsers(roomId: string): Promise<{ userId: string; timestamp: number }[]> {
    try {
      // Get all typing indicators for the room
      // Note: This is a simplified implementation
      // In production, you might want to use a Redis SCAN operation
      
      const activeUsers = await this.getUsersInRoom(roomId);
      const typingUsers: { userId: string; timestamp: number }[] = [];
      
      for (const user of activeUsers) {
        const typingKey = this.getTypingKey(roomId, user.userId);
        const typingData = await this.cacheRepository.get<{ userId: string; roomId: string; timestamp: number }>(typingKey);
        
        if (typingData) {
          typingUsers.push({
            userId: typingData.userId,
            timestamp: typingData.timestamp,
          });
        }
      }
      
      return typingUsers;
    } catch (error) {
      throw new RepositoryError(`Failed to get typing users: ${error}`);
    }
  }

  async clearUserTyping(userId: string): Promise<void> {
    // Clear typing indicators for all rooms for this user
    const userData = await this.getSocketByUserId(userId);
    if (userData) {
      const socketData = await this.getUserBySocketId(userData);
      if (socketData?.roomId) {
        const typingKey = this.getTypingKey(socketData.roomId, userId);
        await this.cacheRepository.delete(typingKey);
      }
    }
  }

  // User activity tracking
  async trackUserActivity(userId: string): Promise<void> {
    const activityKey = this.getUserActivityKey(userId);
    await this.cacheRepository.set(activityKey, {
      userId,
      lastSeen: Date.now(),
    }, this.USER_ACTIVITY_TTL);
  }

  async getUserLastActivity(userId: string): Promise<number | null> {
    const activityKey = this.getUserActivityKey(userId);
    const activity = await this.cacheRepository.get<{ userId: string; lastSeen: number }>(activityKey);
    return activity?.lastSeen || null;
  }

  async isUserActive(userId: string): Promise<boolean> {
    const lastActivity = await this.getUserLastActivity(userId);
    if (!lastActivity) return false;
    
    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity < this.USER_ACTIVITY_TTL * 1000;
  }

  // Session cleanup
  async cleanupExpiredSessions(): Promise<void> {
    await this.userSessionRepository.cleanupExpiredSessions();
  }

  async cleanupExpiredTypingIndicators(): Promise<void> {
    // This would require a more sophisticated implementation in production
    // For now, typing indicators automatically expire due to TTL
  }

  // Utility methods
  async getUserSession(userId: string): Promise<{
    isOnline: boolean;
    socketId: string | null;
    userData: SocketData | null;
    lastActivity: number | null;
    isActive: boolean;
  }> {
    const socketId = await this.getSocketByUserId(userId);
    const userData = socketId ? await this.getUserBySocketId(socketId) : null;
    const lastActivity = await this.getUserLastActivity(userId);
    const isActive = await this.isUserActive(userId);

    return {
      isOnline: !!socketId,
      socketId,
      userData,
      lastActivity,
      isActive,
    };
  }

  async forceDisconnectUser(userId: string): Promise<void> {
    const socketId = await this.getSocketByUserId(userId);
    if (socketId) {
      await this.disconnectUser(socketId);
    }
  }

  async getUserStats(): Promise<{
    totalActiveUsers: number;
    totalActiveRooms: number;
    averageUsersPerRoom: number;
  }> {
    const totalActiveUsers = await this.getOnlineUsersCount();
    const totalActiveRooms = await this.getActiveRoomsCount();
    const averageUsersPerRoom = totalActiveRooms > 0 ? totalActiveUsers / totalActiveRooms : 0;

    return {
      totalActiveUsers,
      totalActiveRooms,
      averageUsersPerRoom,
    };
  }

  private getTypingKey(roomId: string, userId: string): string {
    return `typing:${roomId}:${userId}`;
  }

  private getUserActivityKey(userId: string): string {
    return `activity:${userId}`;
  }
} 