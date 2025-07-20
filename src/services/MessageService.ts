import type { Message, ImageMessage, FileMessage, SystemMessage } from '../types/room';
import type { IMessageRepository, IRoomRepository } from '../types/repositories';
import type { IStorageService } from '../types/storage';
import { NotFoundError, ConflictError } from '../types/repositories';
import { StorageError } from '../types/storage';

export class MessageService {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly roomRepository: IRoomRepository,
    private readonly storageService: IStorageService
  ) {}

  async sendMessage(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    content: string;
    type?: 'text' | 'image' | 'file';
  }): Promise<Message> {
    // Validate room exists and user has access
    await this.validateRoomAccess(messageData.roomId, messageData.userId);

    const message: Message = {
      id: this.generateMessageId(),
      roomId: messageData.roomId,
      userId: messageData.userId,
      userName: messageData.userName,
      userImage: messageData.userImage,
      content: messageData.content,
      type: messageData.type || 'text',
      timestamp: new Date(),
    };

    await this.messageRepository.create(message);
    return message;
  }

  async sendImageMessage(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    imageUrl: string;
    imageName: string;
    imageSize: number;
    thumbnailUrl?: string;
  }): Promise<ImageMessage> {
    // Validate room exists and user has access
    await this.validateRoomAccess(messageData.roomId, messageData.userId);

    const message: ImageMessage = {
      id: this.generateMessageId(),
      roomId: messageData.roomId,
      userId: messageData.userId,
      userName: messageData.userName,
      userImage: messageData.userImage,
      content: `Shared an image: ${messageData.imageName}`,
      type: 'image',
      timestamp: new Date(),
      imageUrl: messageData.imageUrl,
      imageName: messageData.imageName,
      imageSize: messageData.imageSize,
      thumbnailUrl: messageData.thumbnailUrl,
    };

    await this.messageRepository.create(message);
    return message;
  }

  async uploadAndSendImage(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    file: File;
  }): Promise<ImageMessage> {
    try {
      // Validate room exists and user has access
      await this.validateRoomAccess(messageData.roomId, messageData.userId);

      // Upload image to Firebase Storage
      const folder = `rooms/${messageData.roomId}/images`;
      const uploadResult = await this.storageService.uploadImage(messageData.file, folder);

      // Create and store the message with Firebase URL
      const message: ImageMessage = {
        id: this.generateMessageId(),
        roomId: messageData.roomId,
        userId: messageData.userId,
        userName: messageData.userName,
        userImage: messageData.userImage,
        content: `Shared an image: ${uploadResult.fileName}`,
        type: 'image',
        timestamp: new Date(),
        imageUrl: uploadResult.url,
        imageName: uploadResult.fileName,
        imageSize: uploadResult.size,
      };

      await this.messageRepository.create(message);
      return message;
    } catch (error) {
      if (error instanceof StorageError) {
        throw new ConflictError(`Image upload failed: ${error.message}`);
      }
      throw error;
    }
  }

  // New method for server-side buffer uploads
  async uploadAndSendImageFromBuffer(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    buffer: ArrayBuffer | Buffer;
    fileName: string;
    contentType: string;
  }): Promise<ImageMessage> {
    try {
      console.log('uploadAndSendImageFromBuffer called with:', {
        roomId: messageData.roomId,
        fileName: messageData.fileName,
        contentType: messageData.contentType,
        bufferSize: messageData.buffer instanceof Buffer ? messageData.buffer.length : messageData.buffer.byteLength
      });

      // Validate room exists and user has access
      await this.validateRoomAccess(messageData.roomId, messageData.userId);

      // Upload image buffer to Firebase Storage
      const folder = `rooms/${messageData.roomId}/images`;
      const uploadResult = await this.storageService.uploadImageFromBuffer(
        messageData.buffer, 
        messageData.fileName, 
        messageData.contentType, 
        folder
      );

      console.log('Upload result:', uploadResult);

      // Create and store the message with Firebase URL
      const message: ImageMessage = {
        id: this.generateMessageId(),
        roomId: messageData.roomId,
        userId: messageData.userId,
        userName: messageData.userName,
        userImage: messageData.userImage,
        content: `Shared an image: ${uploadResult.fileName}`,
        type: 'image',
        timestamp: new Date(),
        imageUrl: uploadResult.url,
        imageName: uploadResult.fileName,
        imageSize: uploadResult.size,
      };

      await this.messageRepository.create(message);
      console.log('Message created and stored:', message.id);
      return message;
    } catch (error) {
      console.error('Error in uploadAndSendImageFromBuffer:', error);
      if (error instanceof StorageError) {
        throw new ConflictError(`Image upload failed: ${error.message}`);
      }
      throw error;
    }
  }

  async sendFileMessage(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    downloadUrl: string;
  }): Promise<FileMessage> {
    // Validate room exists and user has access
    await this.validateRoomAccess(messageData.roomId, messageData.userId);

    const message: FileMessage = {
      id: this.generateMessageId(),
      roomId: messageData.roomId,
      userId: messageData.userId,
      userName: messageData.userName,
      userImage: messageData.userImage,
      content: `Shared a file: ${messageData.fileName}`,
      type: 'file',
      timestamp: new Date(),
      fileName: messageData.fileName,
      fileSize: messageData.fileSize,
      fileType: messageData.fileType,
      downloadUrl: messageData.downloadUrl,
    };

    await this.messageRepository.create(message);
    return message;
  }

  async uploadAndSendFile(messageData: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    file: File;
  }): Promise<FileMessage> {
    try {
      // Validate room exists and user has access
      await this.validateRoomAccess(messageData.roomId, messageData.userId);

      // Upload file to Firebase Storage
      const folder = `rooms/${messageData.roomId}/files`;
      const uploadResult = await this.storageService.uploadFile(messageData.file, folder);

      // Create and store the message with Firebase URL
      const message: FileMessage = {
        id: this.generateMessageId(),
        roomId: messageData.roomId,
        userId: messageData.userId,
        userName: messageData.userName,
        userImage: messageData.userImage,
        content: `Shared a file: ${uploadResult.fileName}`,
        type: 'file',
        timestamp: new Date(),
        fileName: uploadResult.fileName,
        fileSize: uploadResult.size,
        fileType: uploadResult.contentType,
        downloadUrl: uploadResult.url,
      };

      await this.messageRepository.create(message);
      return message;
    } catch (error) {
      if (error instanceof StorageError) {
        throw new ConflictError(`File upload failed: ${error.message}`);
      }
      throw error;
    }
  }

  async sendSystemMessage(
    roomId: string,
    content: string,
    systemType: 'join' | 'leave' | 'room_created' | 'user_typing'
  ): Promise<SystemMessage> {
    const message: SystemMessage = {
      id: this.generateMessageId(),
      roomId,
      userId: 'system',
      userName: 'System',
      userImage: '',
      content,
      type: 'system',
      timestamp: new Date(),
      systemType,
    };

    await this.messageRepository.create(message);
    return message;
  }

  async editMessage(messageId: string, newContent: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message', messageId);
    }

    // Only allow user to edit their own messages
    if (message.userId !== userId) {
      throw new ConflictError('You can only edit your own messages');
    }

    // System messages cannot be edited
    if (message.type === 'system') {
      throw new ConflictError('System messages cannot be edited');
    }

    // Don't allow editing messages older than 24 hours
    const messageAge = Date.now() - message.timestamp.getTime();
    const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours
    if (messageAge > maxEditAge) {
      throw new ConflictError('Messages older than 24 hours cannot be edited');
    }

    message.content = newContent;
    message.edited = true;
    message.editedAt = new Date();

    await this.messageRepository.update(message);
    return message;
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message', messageId);
    }

    // Only allow user to delete their own messages or room creator
    const room = await this.roomRepository.findById(message.roomId);
    if (!room) {
      throw new NotFoundError('Room', message.roomId);
    }

    const canDelete = message.userId === userId || room.createdBy === userId;
    if (!canDelete) {
      throw new ConflictError('You can only delete your own messages or you must be the room creator');
    }

    // If it's an image or file message, also delete from storage
    if (message.type === 'image') {
      try {
        const imageMessage = message as ImageMessage;
        await this.storageService.deleteFile(imageMessage.imageUrl);
      } catch (error) {
        console.warn('Failed to delete image from storage:', error);
        // Continue with message deletion even if storage deletion fails
      }
    } else if (message.type === 'file') {
      try {
        const fileMessage = message as FileMessage;
        await this.storageService.deleteFile(fileMessage.downloadUrl);
      } catch (error) {
        console.warn('Failed to delete file from storage:', error);
        // Continue with message deletion even if storage deletion fails
      }
    }

    await this.messageRepository.delete(messageId);
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findById(messageId);
  }

  async getRoomMessages(roomId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.messageRepository.findByRoomId(roomId, limit, offset);
  }

  async getMessageCount(roomId: string): Promise<number> {
    return this.messageRepository.getMessageCount(roomId);
  }

  async getLatestMessage(roomId: string): Promise<Message | null> {
    const messages = await this.messageRepository.findByRoomId(roomId, 1, 0);
    return messages.length > 0 ? messages[0] : null;
  }

  async deleteRoomMessages(roomId: string): Promise<void> {
    // Verify room exists
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    // Get all messages for the room and delete associated files
    const messages = await this.messageRepository.findByRoomId(roomId, 1000, 0);
    for (const message of messages) {
      if (message.type === 'image') {
        try {
          const imageMessage = message as ImageMessage;
          await this.storageService.deleteFile(imageMessage.imageUrl);
        } catch (error) {
          console.warn(`Failed to delete image from storage: ${error}`);
        }
      } else if (message.type === 'file') {
        try {
          const fileMessage = message as FileMessage;
          await this.storageService.deleteFile(fileMessage.downloadUrl);
        } catch (error) {
          console.warn(`Failed to delete file from storage: ${error}`);
        }
      }
      await this.messageRepository.delete(message.id);
    }
  }

  async searchMessages(roomId: string, query: string, limit: number = 20): Promise<Message[]> {
    // This is a simple implementation. In production, you might want to use 
    // a full-text search engine like Elasticsearch
    const messages = await this.messageRepository.findByRoomId(roomId, 1000, 0);
    
    const searchTerm = query.toLowerCase();
    return messages
      .filter(message => 
        message.content.toLowerCase().includes(searchTerm) ||
        message.userName.toLowerCase().includes(searchTerm)
      )
      .slice(0, limit);
  }

  private async validateRoomAccess(roomId: string, userId: string): Promise<void> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    if (!room.isActive) {
      throw new ConflictError('Room is no longer active');
    }

    const participant = room.participants.find(p => p.userId === userId);
    if (!participant) {
      throw new ConflictError('User is not a participant of this room');
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
} 