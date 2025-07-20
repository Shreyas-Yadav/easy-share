import { Redis } from '@upstash/redis';
import type { Message } from '../types/room';
import type { IMessageRepository } from '../types/repositories';
import { NotFoundError, RepositoryError } from '../types/repositories';

export class RedisMessageRepository implements IMessageRepository {
  private readonly MESSAGE_PREFIX = 'message:';
  private readonly ROOM_MESSAGES_PREFIX = 'room_messages:';
  private readonly MESSAGE_COUNT_PREFIX = 'message_count:';
  
  constructor(private readonly redis: Redis) {}

  async create(message: Message): Promise<void> {
    try {
      const messageKey = this.getMessageKey(message.id);
      const roomMessagesKey = this.getRoomMessagesKey(message.roomId);
      const countKey = this.getMessageCountKey(message.roomId);
      
      // Store message data
      await this.redis.set(messageKey, this.serializeMessage(message));
      
      // Add message to room's ordered list (using timestamp as score)
      const score = message.timestamp.getTime();
      await this.redis.zadd(roomMessagesKey, { score, member: message.id });
      
      // Increment message count for room
      await this.redis.incr(countKey);
      
      // Optional: Set expiration for old messages (e.g., 30 days)
      await this.redis.expire(messageKey, 30 * 24 * 60 * 60);
    } catch (error) {
      throw new RepositoryError(`Failed to create message: ${error}`);
    }
  }

  async findByRoomId(roomId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    try {
      const roomMessagesKey = this.getRoomMessagesKey(roomId);
      
      // Get message IDs in reverse chronological order (newest first)
      const messageIds = await this.redis.zrange(
        roomMessagesKey,
        offset,
        offset + limit - 1,
        { rev: true }
      );
      
      if (!messageIds || messageIds.length === 0) {
        return [];
      }
      
      // Fetch all messages in parallel
      const messages: Message[] = [];
      for (const messageId of messageIds as string[]) {
        const message = await this.findById(messageId);
        if (message) {
          messages.push(message);
        }
      }
      
      return messages;
    } catch (error) {
      throw new RepositoryError(`Failed to find messages by room ID: ${error}`);
    }
  }

  async findById(id: string): Promise<Message | null> {
    try {
      const messageKey = this.getMessageKey(id);
      const messageData = await this.redis.get(messageKey);
      
      if (!messageData) return null;
      
      return this.deserializeMessage(messageData);
    } catch (error) {
      throw new RepositoryError(`Failed to find message by ID: ${error}`);
    }
  }

  async update(message: Message): Promise<void> {
    try {
      const messageKey = this.getMessageKey(message.id);
      
      // Check if message exists
      const exists = await this.redis.exists(messageKey);
      if (!exists) {
        throw new NotFoundError('Message', message.id);
      }
      
      // Update message data
      await this.redis.set(messageKey, this.serializeMessage(message));
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to update message: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const message = await this.findById(id);
      if (!message) {
        throw new NotFoundError('Message', id);
      }
      
      const messageKey = this.getMessageKey(id);
      const roomMessagesKey = this.getRoomMessagesKey(message.roomId);
      const countKey = this.getMessageCountKey(message.roomId);
      
      // Delete message data
      await this.redis.del(messageKey);
      
      // Remove from room's message list
      await this.redis.zrem(roomMessagesKey, id);
      
      // Decrement message count
      await this.redis.decr(countKey);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to delete message: ${error}`);
    }
  }

  async getMessageCount(roomId: string): Promise<number> {
    const messages = await this.findByRoomId(roomId);
    return messages.length;
  }

  async deleteRoomMessages(roomId: string): Promise<void> {
    console.log('=== DELETING ALL ROOM MESSAGES ===');
    console.log('Room ID:', roomId);

    try {
      // Get all messages for the room
      const messages = await this.findByRoomId(roomId, 1000, 0); // Get a large number to ensure all messages
      console.log(`Found ${messages.length} messages to delete`);

      // Delete each message individually
      for (const message of messages) {
        await this.delete(message.id);
      }

      // Also clean up the room messages list key
      const roomMessagesKey = `room:${roomId}:messages`;
      await this.redis.del(roomMessagesKey);

      console.log(`Successfully deleted ${messages.length} messages for room ${roomId}`);
    } catch (error) {
      console.error('Error deleting room messages:', error);
      throw error;
    }
  }

  async getLatestMessage(roomId: string): Promise<Message | null> {
    try {
      const roomMessagesKey = this.getRoomMessagesKey(roomId);
      
      // Get the latest message ID
      const messageIds = await this.redis.zrange(roomMessagesKey, 0, 0, { rev: true });
      
      if (!messageIds || messageIds.length === 0) {
        return null;
      }
      
      return this.findById(messageIds[0] as string);
    } catch (error) {
      throw new RepositoryError(`Failed to get latest message: ${error}`);
    }
  }

  private getMessageKey(id: string): string {
    return `${this.MESSAGE_PREFIX}${id}`;
  }

  private getRoomMessagesKey(roomId: string): string {
    return `${this.ROOM_MESSAGES_PREFIX}${roomId}`;
  }

  private getMessageCountKey(roomId: string): string {
    return `${this.MESSAGE_COUNT_PREFIX}${roomId}`;
  }

  private serializeMessage(message: Message): string {
    return JSON.stringify({
      ...message,
      timestamp: message.timestamp.toISOString(),
      editedAt: message.editedAt?.toISOString(),
    });
  }

  private deserializeMessage(data: any): Message {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      editedAt: parsed.editedAt ? new Date(parsed.editedAt) : undefined,
    };
  }
} 