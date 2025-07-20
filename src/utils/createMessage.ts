import type { Message, SystemMessage, ImageMessage } from '../types/room';

export function createMessage(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text'
): Message {
  return {
    id: generateMessageId(),
    roomId,
    userId,
    userName,
    userImage,
    content,
    type,
    timestamp: new Date(),
  };
}

export function createSystemMessage(
  roomId: string,
  content: string,
  systemType: 'join' | 'leave' | 'room_created' | 'user_typing'
): SystemMessage {
  return {
    id: generateMessageId(),
    roomId,
    userId: 'system',
    userName: 'System',
    userImage: '',
    content,
    type: 'system',
    timestamp: new Date(),
    systemType,
  };
}

export function createImageMessage(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string,
  imageUrl: string,
  imageName: string,
  imageSize: number,
  thumbnailUrl?: string
): ImageMessage {
  return {
    id: generateMessageId(),
    roomId,
    userId,
    userName,
    userImage,
    content: `Shared an image: ${imageName}`,
    type: 'image',
    timestamp: new Date(),
    imageUrl,
    imageName,
    imageSize,
    thumbnailUrl,
  };
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
} 