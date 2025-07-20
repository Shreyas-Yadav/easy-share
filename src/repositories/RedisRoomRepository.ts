import { Redis } from '@upstash/redis';
import type { Room, RoomParticipant } from '../types/room';
import type { IRoomRepository } from '../types/repositories';
import { NotFoundError, ConflictError, RepositoryError } from '../types/repositories';

export class RedisRoomRepository implements IRoomRepository {
  private readonly ROOM_PREFIX = 'room:';
  private readonly ROOM_CODE_PREFIX = 'room_code:';
  private readonly ACTIVE_ROOMS_KEY = 'active_rooms';
  
  constructor(private readonly redis: Redis) {}

  async create(room: Room): Promise<void> {
    try {
      const roomKey = this.getRoomKey(room.id);
      const codeKey = this.getCodeKey(room.code);
      
      // Check if code already exists
      const existingRoom = await this.redis.get(codeKey);
      if (existingRoom) {
        throw new ConflictError(`Room with code '${room.code}' already exists`);
      }
      
      // Store room data
      await this.redis.set(roomKey, this.serializeRoom(room));
      
      // Store code mapping
      await this.redis.set(codeKey, room.id);
      
      // Add to active rooms set
      if (room.isActive) {
        await this.redis.sadd(this.ACTIVE_ROOMS_KEY, room.id);
      }
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new RepositoryError(`Failed to create room: ${error}`);
    }
  }

  async findById(id: string): Promise<Room | null> {
    try {
      const roomKey = this.getRoomKey(id);
      const roomData = await this.redis.get(roomKey);
      
      if (!roomData) return null;
      
      return this.deserializeRoom(roomData);
    } catch (error) {
      throw new RepositoryError(`Failed to find room by ID: ${error}`);
    }
  }

  async findByCode(code: string): Promise<Room | null> {
    try {
      const codeKey = this.getCodeKey(code);
      const roomId = await this.redis.get(codeKey);
      
      if (!roomId) return null;
      
      return this.findById(roomId as string);
    } catch (error) {
      throw new RepositoryError(`Failed to find room by code: ${error}`);
    }
  }

  async update(room: Room): Promise<void> {
    try {
      const roomKey = this.getRoomKey(room.id);
      
      // Check if room exists
      const exists = await this.redis.exists(roomKey);
      if (!exists) {
        throw new NotFoundError('Room', room.id);
      }
      
      // Update room data
      await this.redis.set(roomKey, this.serializeRoom(room));
      
      // Update active rooms set
      if (room.isActive) {
        await this.redis.sadd(this.ACTIVE_ROOMS_KEY, room.id);
      } else {
        await this.redis.srem(this.ACTIVE_ROOMS_KEY, room.id);
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to update room: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const room = await this.findById(id);
      if (!room) {
        throw new NotFoundError('Room', id);
      }
      
      const roomKey = this.getRoomKey(id);
      const codeKey = this.getCodeKey(room.code);
      
      // Delete room data
      await this.redis.del(roomKey);
      
      // Delete code mapping
      await this.redis.del(codeKey);
      
      // Remove from active rooms
      await this.redis.srem(this.ACTIVE_ROOMS_KEY, id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to delete room: ${error}`);
    }
  }

  async findActiveRooms(): Promise<Room[]> {
    try {
      const activeRoomIds = await this.redis.smembers(this.ACTIVE_ROOMS_KEY);
      
      if (!activeRoomIds || activeRoomIds.length === 0) {
        return [];
      }
      
      const rooms: Room[] = [];
      for (const roomId of activeRoomIds as string[]) {
        const room = await this.findById(roomId);
        if (room) {
          rooms.push(room);
        }
      }
      
      return rooms;
    } catch (error) {
      throw new RepositoryError(`Failed to find active rooms: ${error}`);
    }
  }

  async addParticipant(roomId: string, participant: RoomParticipant): Promise<void> {
    try {
      const room = await this.findById(roomId);
      if (!room) {
        throw new NotFoundError('Room', roomId);
      }
      
      // Remove existing participant if any
      room.participants = room.participants.filter(p => p.userId !== participant.userId);
      
      // Add new participant
      room.participants.push(participant);
      
      await this.update(room);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to add participant: ${error}`);
    }
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    try {
      const room = await this.findById(roomId);
      if (!room) {
        throw new NotFoundError('Room', roomId);
      }
      
      room.participants = room.participants.filter(p => p.userId !== userId);
      await this.update(room);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to remove participant: ${error}`);
    }
  }

  async updateParticipantStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
    try {
      const room = await this.findById(roomId);
      if (!room) {
        throw new NotFoundError('Room', roomId);
      }
      
      const participant = room.participants.find(p => p.userId === userId);
      if (participant) {
        participant.isOnline = isOnline;
        participant.lastSeen = new Date();
        await this.update(room);
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to update participant status: ${error}`);
    }
  }

  private getRoomKey(id: string): string {
    return `${this.ROOM_PREFIX}${id}`;
  }

  private getCodeKey(code: string): string {
    return `${this.ROOM_CODE_PREFIX}${code.toUpperCase()}`;
  }

  private serializeRoom(room: Room): string {
    return JSON.stringify({
      ...room,
      createdAt: room.createdAt.toISOString(),
      participants: room.participants.map(p => ({
        ...p,
        joinedAt: p.joinedAt.toISOString(),
        lastSeen: p.lastSeen.toISOString(),
      })),
    });
  }

  private deserializeRoom(data: any): Room { // eslint-disable-line @typescript-eslint/no-explicit-any
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      participants: parsed.participants.map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        ...p,
        joinedAt: new Date(p.joinedAt),
        lastSeen: new Date(p.lastSeen),
      })),
    };
  }
} 