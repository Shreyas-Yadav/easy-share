import { Socket } from 'socket.io-client';
import type { BillExtraction, BillParticipant } from './models';

export interface Room {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: Date;
  participants: RoomParticipant[];
  isActive: boolean;
  maxParticipants?: number;
}

export interface RoomParticipant {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  joinedAt: Date;
  isOnline: boolean;
  lastSeen: Date;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userImage: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
}

export interface ImageMessage extends Message {
  type: 'image';
  imageUrl: string;
  imageSize: number;
  imageName: string;
  thumbnailUrl?: string;
}

export interface FileMessage extends Message {
  type: 'file';
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
}

export interface SystemMessage extends Message {
  type: 'system';
  systemType: 'join' | 'leave' | 'room_created' | 'user_typing';
}

// Socket Event Types
export interface ServerToClientEvents {
  // Room events
  'room:created': (room: Room) => void;
  'room:joined': (data: { room: Room; participant: RoomParticipant }) => void;
  'room:left': (data: { roomId: string; userId: string }) => void;
  'room:updated': (room: Room) => void;
  'room:error': (error: string) => void;
  'room:deleted': (roomId: string) => void;
  
  // Message events
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  
  // User events
  'user:joined': (participant: RoomParticipant) => void;
  'user:left': (userId: string) => void;
  'user:typing': (data: { userId: string; userName: string; isTyping: boolean }) => void;
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
  
  // Image events (only image-related events)
  'image:uploaded': (message: ImageMessage) => void;
  
  // Bill extraction events
  'bill:extracted': (billExtraction: BillExtraction) => void;
  'bill:updated': (billExtraction: BillExtraction) => void;
}

export interface ClientToServerEvents {
  // Authentication
  'user:authenticate': (userData: Omit<SocketData, 'roomId'>) => void;
  'user:logout': (userId: string) => void;
  
  // Room events
  'room:create': (data: { name: string; maxParticipants?: number }) => void;
  'room:join': (data: { code: string }) => void;
  'room:leave': (roomId: string) => void;
  'room:delete': (data: { roomId: string }) => void;
  
  // Message events
  'message:send': (data: { roomId: string; content: string; type?: 'text' }) => void;
  'message:edit': (data: { messageId: string; content: string }) => void;
  'message:delete': (messageId: string) => void;
  
  // User events
  'user:typing': (data: { roomId: string; isTyping: boolean }) => void;
  'user:ping': () => void;
  
  // Image events (HTTP upload + socket broadcast)
  'image:uploaded': (data: { roomId: string; message: ImageMessage }) => void;
  
  // Bill extraction events
  'bill:extract': (data: { roomId: string; imageUrl: string; imageName: string }) => void;
  'bill:update': (data: { billId: string; itemAssignments: Record<number, string[]> }) => void;
  'bill:updateParticipants': (data: { billId: string; billParticipants: BillParticipant[] }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  userImage: string;
  email: string;
  roomId?: string;
}

// Component Props Types
export interface RoomContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  currentRoom: Room | null;
  messages: Message[];
  participants: RoomParticipant[];
  isConnected: boolean;
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  currentUserId: string | null;
  
  // Actions
  createRoom: (name: string, maxParticipants?: number) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  deleteRoom: () => void;
  sendMessage: (content: string) => void;
  sendImage: (file: File) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
}

export interface CreateRoomFormData {
  name: string;
  maxParticipants: number;
}

export interface JoinRoomFormData {
  code: string;
}

// Utility types
export type TypingUsers = Record<string, { userName: string; timestamp: number }>;

export interface RoomStats {
  totalMessages: number;
  totalParticipants: number;
  filesShared: number;
  roomAge: string;
} 