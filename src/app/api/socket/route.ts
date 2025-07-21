import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import type { 
  RoomParticipant, 
  SocketData,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents
} from '../../../types/room';
import { redisdb } from '../../../utils/redisdb';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { ServiceFactory } from '../../../factories/ServiceFactory';
import { NotFoundError, ConflictError } from '../../../types/repositories';

// Initialize factories and services
const repositoryFactory = RepositoryFactory.getInstance(redisdb);
const serviceFactory = ServiceFactory.getInstance(repositoryFactory);
const roomService = serviceFactory.createRoomService();
const messageService = serviceFactory.createMessageService();
const userSessionService = serviceFactory.createUserSessionService();

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export async function GET() {
  if (io) {
    return new Response('Socket server already running', { status: 200 });
  }

  try {
    const httpServer = createServer();
    
    io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.NEXT_PUBLIC_APP_URL || ''] 
          : ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['polling', 'websocket'],
    });

    // Socket connection handling
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Log all incoming events for debugging
      socket.onAny((eventName, ...args) => {
        console.log(`[DEBUG] Event received: ${eventName}`, { 
          socketId: socket.id, 
          argsCount: args.length,
          firstArgKeys: args[0] ? Object.keys(args[0]) : 'no args'
        });
      });

      // User authentication
      socket.on('user:authenticate', async (data) => {
        try {
          await userSessionService.authenticateUser(data, socket.id);
          console.log(`User authenticated: ${data.userName} (${data.userId})`);
        } catch (error) {
          console.error('Authentication failed:', error);
          socket.emit('room:error', 'Authentication failed');
        }
      });

      // User logout - explicit logout cleanup
      socket.on('user:logout', async (userId) => {
        console.log('=== USER LOGOUT EVENT ===');
        console.log('Logout request for user:', userId);
        
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          
          // Verify the logout request is for the correct user
          if (!userData || userData.userId !== userId) {
            console.log('Logout request rejected: user mismatch or not found');
            return;
          }

          console.log(`Processing logout for user: ${userData.userName} (${userId})`);

          // If user is in a room, remove them and notify others
          if (userData.roomId) {
            await roomService.leaveRoom(userData.roomId, userId);
            
            // Notify other users in the room
            socket.to(userData.roomId).emit('user:left', userId);
            
            // Send system message
            const systemMessage = await messageService.sendSystemMessage(
              userData.roomId,
              `${userData.userName} logged out`,
              'leave'
            );
            socket.to(userData.roomId).emit('message:new', systemMessage);
          }

          // Perform comprehensive session cleanup
          await userSessionService.cleanupUserLogout(userId);

          // Disconnect the socket
          socket.disconnect();

          console.log(`SUCCESS: User logout completed for ${userId}`);
        } catch (error) {
          console.error('Error handling user logout:', error);
        }
      });

      // Room creation
      socket.on('room:create', async (data) => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData) {
            socket.emit('room:error', 'User not authenticated');
            return;
          }

          const room = await roomService.createRoom({
            name: data.name,
            createdBy: userData.userId,
            maxParticipants: data.maxParticipants || 50,
          });

          // Create participant data
          const participant: RoomParticipant = {
            userId: userData.userId,
            firstName: userData.userName.split(' ')[0] || userData.userName,
            lastName: userData.userName.split(' ')[1] || '',
            email: userData.email,
            imageUrl: userData.userImage,
            joinedAt: new Date(),
            isOnline: true,
            lastSeen: new Date(),
          };

          // Add creator as participant
          await roomService.addParticipant(room.id, participant);
          
          // Join the socket room
          await socket.join(room.id);
          await userSessionService.updateUserRoom(userData.userId, room.id);

          // Get updated room with participant
          const updatedRoom = await roomService.findRoomById(room.id);

          // Send success response with empty message history
          socket.emit('room:created', updatedRoom!);
          
          // Send system message
          const systemMessage = await messageService.sendSystemMessage(
            room.id,
            `${userData.userName} created the room`,
            'room_created'
          );
          io.to(room.id).emit('message:new', systemMessage);

          console.log(`Room created: ${room.name} (${room.code})`);
        } catch (error) {
          // Only log unexpected errors, not business logic errors
          if (error instanceof ConflictError) {
            socket.emit('room:error', error.message);
          } else {
            // Log unexpected system errors
            console.error('Unexpected error creating room:', error);
            socket.emit('room:error', 'Failed to create room');
          }
        }
      });

      // Room joining
      socket.on('room:join', async (data) => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData) {
            socket.emit('room:error', 'User not authenticated');
            return;
          }

          // Create participant data
          const participant: RoomParticipant = {
            userId: userData.userId,
            firstName: userData.userName.split(' ')[0] || userData.userName,
            lastName: userData.userName.split(' ')[1] || '',
            email: userData.email,
            imageUrl: userData.userImage,
            joinedAt: new Date(),
            isOnline: true,
            lastSeen: new Date(),
          };

          const { room, participant: joinedParticipant } = await roomService.joinRoom(data.code, participant);

          // Join the socket room
          await socket.join(room.id);
          await userSessionService.updateUserRoom(userData.userId, room.id);

          // Notify user of successful join with recent messages
          socket.emit('room:joined', { 
            room, 
            participant: joinedParticipant
          });

          // Send recent messages separately
          const recentMessages = await messageService.getRoomMessages(room.id, 50, 0);
          for (const message of recentMessages.reverse()) {
            socket.emit('message:new', message);
          }

          // Notify other users
          socket.to(room.id).emit('user:joined', joinedParticipant);

          // Send system message
          const systemMessage = await messageService.sendSystemMessage(
            room.id,
            `${userData.userName} joined the room`,
            'join'
          );
          io.to(room.id).emit('message:new', systemMessage);

          console.log(`User ${userData.userName} joined room ${room.name}`);
        } catch (error) {
          // Only log unexpected errors, not business logic errors
          if (error instanceof NotFoundError) {
            socket.emit('room:error', 'Room not found');
          } else if (error instanceof ConflictError) {
            socket.emit('room:error', error.message);
          } else {
            // Log unexpected system errors
            console.error('Unexpected error joining room:', error);
            socket.emit('room:error', 'Failed to join room');
          }
        }
      });

      // Leave room
      socket.on('room:leave', async (roomId) => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData) return;

          await roomService.leaveRoom(roomId, userData.userId);

          // Leave socket room
          await socket.leave(roomId);
          await userSessionService.updateUserRoom(userData.userId, undefined);

          // Notify other users
          socket.to(roomId).emit('user:left', userData.userId);

          // Send system message
          const systemMessage = await messageService.sendSystemMessage(
            roomId,
            `${userData.userName} left the room`,
            'leave'
          );
          socket.to(roomId).emit('message:new', systemMessage);

          console.log(`User ${userData.userName} left room ${roomId}`);
        } catch (error) {
          console.error('Error leaving room:', error);
        }
      });

      // Delete room
      socket.on('room:delete', async (data) => {
        console.log('=== ROOM DELETE REQUEST ===');
        console.log('Delete request for room:', data.roomId);

        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData) {
            socket.emit('room:error', 'User not authenticated');
            return;
          }

          console.log('Delete request from user:', userData.userName, userData.userId);

          // Delete the room (this includes authorization check)
          await roomService.deleteRoom(data.roomId, userData.userId);

          console.log('Room deleted successfully, notifying all participants');

          // Notify all users in the room that it's being deleted
          io.to(data.roomId).emit('room:deleted', data.roomId);

          // Disconnect all users from the room
          const socketsInRoom = await io.in(data.roomId).fetchSockets();
          for (const roomSocket of socketsInRoom) {
            await roomSocket.leave(data.roomId);
          }

          console.log(`SUCCESS: Room ${data.roomId} deleted by ${userData.userName}`);
        } catch (error) {
          // Only log unexpected errors, not business logic errors
          if (error instanceof NotFoundError) {
            socket.emit('room:error', 'Room not found');
          } else if (error instanceof ConflictError) {
            socket.emit('room:error', error.message);
          } else {
            console.error('=== ROOM DELETE ERROR ===');
            console.error('Unexpected error deleting room:', error);
            socket.emit('room:error', 'Failed to delete room');
          }
        }
      });

      // Send message
      socket.on('message:send', async (data) => {
        console.log('=== TEXT MESSAGE SEND EVENT RECEIVED ===');
        console.log('Message data:', {
          roomId: data.roomId,
          content: data.content?.substring(0, 100) + (data.content?.length > 100 ? '...' : ''),
          type: data.type
        });

        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          console.log('User data for message send:', {
            hasUserData: !!userData,
            userId: userData?.userId,
            userName: userData?.userName,
            userRoomId: userData?.roomId,
            requestedRoomId: data.roomId,
            roomMatch: userData?.roomId === data.roomId
          });

          if (!userData || userData.roomId !== data.roomId) {
            console.error('Message send validation failed:', {
              userData: !!userData,
              roomMatch: userData?.roomId === data.roomId
            });
            return;
          }

          console.log('Creating text message...');
          const message = await messageService.sendMessage({
            roomId: data.roomId,
            userId: userData.userId,
            userName: userData.userName,
            userImage: userData.userImage,
            content: data.content,
            type: data.type || 'text',
          });

          console.log('Text message created, broadcasting...');
          // Broadcast message to all users in the room
          io.to(data.roomId).emit('message:new', message);

          console.log(`SUCCESS: Message sent in room ${data.roomId}: ${data.content.substring(0, 50)}...`);
        } catch (error) {
          // Only log unexpected errors, not business logic errors
          if (error instanceof ConflictError) {
            socket.emit('room:error', error.message);
          } else {
            console.error('=== TEXT MESSAGE ERROR ===');
            console.error('Unexpected error sending message:', error);
          }
        }
      });

      // Image uploaded (after HTTP upload)
      socket.on('image:uploaded', async (data) => {
        console.log('=== IMAGE UPLOADED BROADCAST EVENT ===');
        console.log('Broadcasting image message:', {
          roomId: data.roomId,
          messageId: data.message.id,
          imageName: data.message.imageName
        });

        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData || userData.roomId !== data.roomId) {
            console.error('User validation failed for image broadcast');
            return;
          }

          // Broadcast the image message to all users in the room
          io.to(data.roomId).emit('message:new', data.message);

          console.log('SUCCESS: Image message broadcasted to room', data.roomId);
        } catch (error) {
          console.error('Error broadcasting image message:', error);
        }
      });

      // Typing indicator
      socket.on('user:typing', async (data) => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (!userData || userData.roomId !== data.roomId) {
            return;
          }

          await userSessionService.setUserTyping(userData.userId, data.roomId, data.isTyping);

          // Broadcast typing status to other users in the room
          socket.to(data.roomId).emit('user:typing', {
            userId: userData.userId,
            userName: userData.userName,
            isTyping: data.isTyping,
          });
        } catch (error) {
          console.error('Error handling typing indicator:', error);
        }
      });

      // User ping for keep-alive
      socket.on('user:ping', async () => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (userData) {
            await userSessionService.trackUserActivity(userData.userId);
          }
        } catch (error) {
          console.error('Error handling ping:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        try {
          const userData = await userSessionService.getUserBySocketId(socket.id);
          if (userData) {
            // Only log for explicit disconnects, not page refreshes
            if (reason !== 'client namespace disconnect' && reason !== 'transport close') {
              console.log(`User disconnected: ${userData.userName} (${userData.userId}) - Reason: ${reason}`);
            }
            
            // Update participant status if they were in a room
            if (userData.roomId) {
              await roomService.updateParticipantStatus(userData.roomId, userData.userId, false);
              
              // Notify other users
              socket.to(userData.roomId).emit('user:offline', userData.userId);
            }
            
            // Clean up user session
            await userSessionService.disconnectUser(socket.id);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });

    // Start the HTTP server
    const port = process.env.SOCKET_PORT || 3001;
    httpServer.listen(port, () => {
      console.log(`Socket server running on port ${port}`);
    });

    // Periodic cleanup of expired sessions
    setInterval(async () => {
      try {
        await userSessionService.cleanupExpiredSessions();
        await roomService.cleanupInactiveRooms();
      } catch (error) {
        console.error('Error during periodic cleanup:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return new Response('Socket server started', { status: 200 });
  } catch (error) {
    console.error('Failed to start socket server:', error);
    return new Response('Failed to start socket server', { status: 500 });
  }
} 