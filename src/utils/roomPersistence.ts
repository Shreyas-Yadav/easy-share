import type { Room } from '../types/room';

const ROOM_STORAGE_KEY = 'easy_share_current_room';

export interface PersistedRoomData {
  roomId: string;
  roomCode: string;
  roomName: string;
  userId: string;
  timestamp: number;
}

export class RoomPersistence {
  /**
   * Store current room data in localStorage
   */
  static storeRoom(room: Room, userId: string): void {
    try {
      const data: PersistedRoomData = {
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        userId,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(data));
      console.log('Room persisted to localStorage:', data);
    } catch (error) {
      console.error('Failed to persist room to localStorage:', error);
    }
  }

  /**
   * Retrieve stored room data from localStorage
   */
  static getStoredRoom(): PersistedRoomData | null {
    try {
      const stored = localStorage.getItem(ROOM_STORAGE_KEY);
      if (!stored) return null;

      const data: PersistedRoomData = JSON.parse(stored);
      
      // Check if stored data is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - data.timestamp > maxAge) {
        console.log('Stored room data is too old, clearing...');
        RoomPersistence.clearStoredRoom();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to retrieve stored room from localStorage:', error);
      RoomPersistence.clearStoredRoom(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Clear stored room data from localStorage
   */
  static clearStoredRoom(): void {
    try {
      localStorage.removeItem(ROOM_STORAGE_KEY);
      console.log('Stored room data cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear stored room from localStorage:', error);
    }
  }

  /**
   * Check if there's a stored room for the current user
   */
  static hasStoredRoomForUser(userId: string): boolean {
    const stored = RoomPersistence.getStoredRoom();
    return stored !== null && stored.userId === userId;
  }

  /**
   * Update timestamp of stored room (for activity tracking)
   */
  static updateStoredRoomTimestamp(): void {
    try {
      const stored = RoomPersistence.getStoredRoom();
      if (stored) {
        stored.timestamp = Date.now();
        localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(stored));
      }
    } catch (error) {
      console.error('Failed to update stored room timestamp:', error);
    }
  }
} 