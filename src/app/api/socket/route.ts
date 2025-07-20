import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import type { 
  Room, 
  RoomParticipant, 
  Message, 
  SystemMessage, 
  SocketData,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents
} from '../../../types/room';

// In-memory storage (in production, use Redis or database)
const rooms = new Map<string, Room>();
const userSockets = new Map<string, string>(); // userId -> socketId
const socketUsers = new Map<string, SocketData>(); // socketId -> userData

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createMessage(
  roomId: string,
  userId: string,
  userName: string,
  userImage: string,
  content: string,
  type: 'text' | 'system' = 'text'
): Message {
  return {
    id: Math.random().toString(36).substring(2, 9),
    roomId,
    userId,
    userName,
    userImage,
    content,
    type,
    timestamp: new Date(),
  };
}

function createSystemMessage(
  roomId: string,
  content: string,
  systemType: SystemMessage['systemType']
): SystemMessage {
  return {
    id: Math.random().toString(36).substring(2, 9),
    roomId,
    userId: 'system',
    userName: 'System',
    userImage: '',
    content,
    type: 'system',
    systemType,
    timestamp: new Date(),
  };
}

export async function GET(req: NextRequest) {
  if (!io) {
    console.log('Initializing Socket.IO server...');
    
    // Create HTTP server for Socket.IO
    const httpServer = createServer();
    
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXTAUTH_URL 
          : "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['polling', 'websocket'],
    });

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // Store socket user data
      socket.on('user:authenticate', (userData: Omit<SocketData, 'roomId'>) => {
        const fullUserData: SocketData = { ...userData, roomId: undefined };
        socketUsers.set(socket.id, fullUserData);
        userSockets.set(userData.userId, socket.id);
        
        console.log('User authenticated:', userData.userName);
      });

      // Room creation
      socket.on('room:create', async (data) => {
        try {
          const userData = socketUsers.get(socket.id);
          if (!userData) {
            socket.emit('room:error', 'User not authenticated');
            return;
          }

          const roomCode = generateRoomCode();
          const room: Room = {
            id: Math.random().toString(36).substring(2, 9),
            name: data.name,
            code: roomCode,
            createdBy: userData.userId,
            createdAt: new Date(),
            participants: [{
              userId: userData.userId,
              firstName: userData.userName.split(' ')[0] || userData.userName,
              lastName: userData.userName.split(' ')[1] || '',
              email: userData.email,
              imageUrl: userData.userImage,
              joinedAt: new Date(),
              isOnline: true,
              lastSeen: new Date(),
            }],
            isActive: true,
            maxParticipants: data.maxParticipants || 50,
          };

          rooms.set(room.id, room);
          
          // Join the socket room
          await socket.join(room.id);
          userData.roomId = room.id;
          socketUsers.set(socket.id, userData);

          // Send success response
          socket.emit('room:created', room);
          
          // Send system message
          const systemMessage = createSystemMessage(
            room.id,
            `${userData.userName} created the room`,
            'room_created'
          );
          io.to(room.id).emit('message:new', systemMessage);

          console.log(`Room created: ${room.name} (${room.code})`);
        } catch (error) {
          console.error('Error creating room:', error);
          socket.emit('room:error', 'Failed to create room');
        }
      });

      // Room joining
      socket.on('room:join', async (data) => {
        try {
          const userData = socketUsers.get(socket.id);
          if (!userData) {
            socket.emit('room:error', 'User not authenticated');
            return;
          }

          // Find room by code
          const room = Array.from(rooms.values()).find(r => r.code === data.code.toUpperCase());
          if (!room) {
            socket.emit('room:error', 'Room not found');
            return;
          }

          if (!room.isActive) {
            socket.emit('room:error', 'Room is no longer active');
            return;
          }

          if (room.maxParticipants && room.participants.length >= room.maxParticipants) {
            socket.emit('room:error', 'Room is full');
            return;
          }

          // Check if user is already in the room
          const existingParticipant = room.participants.find(p => p.userId === userData.userId);
          if (existingParticipant) {
            // Update existing participant
            existingParticipant.isOnline = true;
            existingParticipant.lastSeen = new Date();
          } else {
            // Add new participant
            const newParticipant: RoomParticipant = {
              userId: userData.userId,
              firstName: userData.userName.split(' ')[0] || userData.userName,
              lastName: userData.userName.split(' ')[1] || '',
              email: userData.email,
              imageUrl: userData.userImage,
              joinedAt: new Date(),
              isOnline: true,
              lastSeen: new Date(),
            };
            room.participants.push(newParticipant);
          }

          // Join the socket room
          await socket.join(room.id);
          userData.roomId = room.id;
          socketUsers.set(socket.id, userData);

          // Update room in storage
          rooms.set(room.id, room);

          // Notify user of successful join
          socket.emit('room:joined', { 
            room, 
            participant: room.participants.find(p => p.userId === userData.userId)! 
          });

          // Notify other users
          socket.to(room.id).emit('user:joined', 
            room.participants.find(p => p.userId === userData.userId)!
          );

          // Send system message
          const systemMessage = createSystemMessage(
            room.id,
            `${userData.userName} joined the room`,
            'join'
          );
          io.to(room.id).emit('message:new', systemMessage);

          console.log(`User ${userData.userName} joined room ${room.name}`);
        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('room:error', 'Failed to join room');
        }
      });

      // Leave room
      socket.on('room:leave', async (roomId) => {
        try {
          const userData = socketUsers.get(socket.id);
          if (!userData) return;

          const room = rooms.get(roomId);
          if (!room) return;

          // Update participant status
          const participant = room.participants.find(p => p.userId === userData.userId);
          if (participant) {
            participant.isOnline = false;
            participant.lastSeen = new Date();
          }

          // Leave socket room
          await socket.leave(roomId);
          userData.roomId = undefined;
          socketUsers.set(socket.id, userData);

          // Update room
          rooms.set(room.id, room);

          // Notify other users
          socket.to(roomId).emit('user:left', userData.userId);

          // Send system message
          const systemMessage = createSystemMessage(
            room.id,
            `${userData.userName} left the room`,
            'leave'
          );
          socket.to(roomId).emit('message:new', systemMessage);

          console.log(`User ${userData.userName} left room ${room.name}`);
        } catch (error) {
          console.error('Error leaving room:', error);
        }
      });

      // Send message
      socket.on('message:send', (data) => {
        try {
          const userData = socketUsers.get(socket.id);
          if (!userData || userData.roomId !== data.roomId) {
            return;
          }

          const room = rooms.get(data.roomId);
          if (!room) return;

          const message = createMessage(
            data.roomId,
            userData.userId,
            userData.userName,
            userData.userImage,
            data.content,
            data.type || 'text'
          );

          // Broadcast message to all users in the room
          io.to(data.roomId).emit('message:new', message);

          console.log(`Message sent in room ${room.name}: ${data.content}`);
        } catch (error) {
          console.error('Error sending message:', error);
        }
      });

      // Typing indicator
      socket.on('user:typing', (data) => {
        const userData = socketUsers.get(socket.id);
        if (!userData || userData.roomId !== data.roomId) return;

        socket.to(data.roomId).emit('user:typing', {
          userId: userData.userId,
          userName: userData.userName,
          isTyping: data.isTyping
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const userData = socketUsers.get(socket.id);
        if (userData) {
          // Update user status in room
          if (userData.roomId) {
            const room = rooms.get(userData.roomId);
            if (room) {
              const participant = room.participants.find(p => p.userId === userData.userId);
              if (participant) {
                participant.isOnline = false;
                participant.lastSeen = new Date();
              }
              
              rooms.set(room.id, room);
              socket.to(userData.roomId).emit('user:offline', userData.userId);
            }
          }

          // Clean up maps
          userSockets.delete(userData.userId);
          socketUsers.delete(socket.id);
        }
      });

      // Keep-alive ping
      socket.on('user:ping', () => {
        const userData = socketUsers.get(socket.id);
        if (userData && userData.roomId) {
          const room = rooms.get(userData.roomId);
          if (room) {
            const participant = room.participants.find(p => p.userId === userData.userId);
            if (participant) {
              participant.lastSeen = new Date();
            }
            rooms.set(room.id, room);
          }
        }
      });
    });

    // Start listening on a dynamic port for Socket.IO
    const port = parseInt(process.env.SOCKET_PORT || '3001');
    httpServer.listen(port, () => {
      console.log(`Socket.IO server running on port ${port}`);
    });
  }

  return new Response(JSON.stringify({ message: 'Socket.IO server initialized' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
} 