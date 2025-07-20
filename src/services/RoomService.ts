import type { Room, RoomParticipant, Message } from '../types/room';
import type { IRoomRepository, IMessageRepository, IUserSessionRepository } from '../types/repositories';
import { NotFoundError, ConflictError } from '../types/repositories';

export class RoomService {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly userSessionRepository: IUserSessionRepository
  ) {}

  async createRoom(roomData: {
    name: string;
    createdBy: string;
    maxParticipants?: number;
  }): Promise<Room> {
    const room: Room = {
      id: this.generateRoomId(),
      name: roomData.name,
      code: this.generateRoomCode(),
      createdBy: roomData.createdBy,
      createdAt: new Date(),
      participants: [],
      isActive: true,
      maxParticipants: roomData.maxParticipants || 50,
    };

    await this.roomRepository.create(room);
    return room;
  }

  async findRoomById(id: string): Promise<Room | null> {
    return this.roomRepository.findById(id);
  }

  async findRoomByCode(code: string): Promise<Room | null> {
    return this.roomRepository.findByCode(code.toUpperCase());
  }

  async joinRoom(code: string, participant: RoomParticipant): Promise<{ room: Room; participant: RoomParticipant }> {
    const room = await this.findRoomByCode(code);
    if (!room) {
      throw new NotFoundError('Room', code);
    }

    if (!room.isActive) {
      throw new ConflictError('Room is no longer active');
    }

    if (room.maxParticipants && room.participants.length >= room.maxParticipants) {
      throw new ConflictError('Room is full');
    }

    // Check if user is already in the room
    const existingParticipant = room.participants.find(p => p.userId === participant.userId);
    if (existingParticipant) {
      // Update existing participant
      existingParticipant.isOnline = true;
      existingParticipant.lastSeen = new Date();
      await this.roomRepository.update(room);
      return { room, participant: existingParticipant };
    } else {
      // Add new participant
      await this.roomRepository.addParticipant(room.id, participant);
      const updatedRoom = await this.findRoomById(room.id);
      return { 
        room: updatedRoom!, 
        participant: updatedRoom!.participants.find(p => p.userId === participant.userId)! 
      };
    }
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    await this.roomRepository.updateParticipantStatus(roomId, userId, false);
  }

  async addParticipant(roomId: string, participant: RoomParticipant): Promise<void> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    if (!room.isActive) {
      throw new ConflictError('Room is no longer active');
    }

    if (room.maxParticipants && room.participants.length >= room.maxParticipants) {
      throw new ConflictError('Room is full');
    }

    await this.roomRepository.addParticipant(roomId, participant);
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.roomRepository.removeParticipant(roomId, userId);
  }

  async updateParticipantStatus(roomId: string, userId: string, isOnline: boolean): Promise<void> {
    await this.roomRepository.updateParticipantStatus(roomId, userId, isOnline);
  }

  async deactivateRoom(roomId: string): Promise<void> {
    const room = await this.roomRepository.findById(roomId);
    if (room) {
      room.isActive = false;
      await this.roomRepository.update(room);
    }
  }

  async deleteRoom(roomId: string, requestingUserId: string): Promise<void> {
    console.log('=== DELETING ROOM ===');
    console.log('Room ID:', roomId, 'Requesting User:', requestingUserId);

    // Get room to verify creator
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    // Only room creator can delete the room
    if (room.createdBy !== requestingUserId) {
      throw new ConflictError('Only the room creator can delete the room');
    }

    console.log('1. Authorization passed, room creator confirmed');

    // Delete all room messages (this will also clean up Firebase Storage)
    console.log('2. Deleting all room messages and images...');
    await this.messageRepository.deleteRoomMessages(roomId);

    // Update participants to offline and remove from room
    console.log('3. Updating participants...');
    for (const participant of room.participants) {
      await this.userSessionRepository.updateUserRoom(participant.userId, undefined);
    }

    // Delete the room itself
    console.log('4. Deleting room from Redis...');
    await this.roomRepository.delete(roomId);

    console.log('5. Room deletion completed successfully');
  }

  async getActiveRooms(): Promise<Room[]> {
    return this.roomRepository.findActiveRooms();
  }

  async getRoomMessages(roomId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    return this.messageRepository.findByRoomId(roomId, limit, offset);
  }

  async getRoomMessageCount(roomId: string): Promise<number> {
    return this.messageRepository.getMessageCount(roomId);
  }

  async getOnlineParticipants(roomId: string): Promise<RoomParticipant[]> {
    const room = await this.findRoomById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    return room.participants.filter(p => p.isOnline);
  }

  async validateRoomAccess(roomId: string, userId: string): Promise<boolean> {
    const room = await this.findRoomById(roomId);
    if (!room || !room.isActive) {
      return false;
    }

    const participant = room.participants.find(p => p.userId === userId);
    return !!participant;
  }

  async cleanupInactiveRooms(): Promise<void> {
    const activeRooms = await this.getActiveRooms();
    
    for (const room of activeRooms) {
      const onlineUsers = await this.userSessionRepository.getUsersInRoom(room.id);
      
      // If no users online for more than 1 hour, deactivate room
      const hasRecentActivity = room.participants.some(p => {
        const timeSinceLastSeen = Date.now() - p.lastSeen.getTime();
        return timeSinceLastSeen < 60 * 60 * 1000; // 1 hour
      });

      if (onlineUsers.length === 0 && !hasRecentActivity) {
        await this.deactivateRoom(room.id);
      }
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
} 