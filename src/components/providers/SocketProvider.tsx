'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import type { 
  RoomContextType, 
  Room, 
  Message, 
  RoomParticipant, 
  TypingUsers,
  ServerToClientEvents,
  ClientToServerEvents
} from '../../types/room';

const SocketContext = createContext<RoomContextType | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user } = useUser();
  const router = useRouter();
  
  // Socket and connection state
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Room state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  
  // Typing state
  const [typingUsers, setTypingUsers] = useState<TypingUsers>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    console.log('Initializing socket connection...');
    
    // Initialize the socket.io server first
    fetch('/api/socket')
      .then(() => {
        // Create socket connection
        const newSocket = io(process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_SOCKET_URL || ''
          : 'http://localhost:3001', {
          transports: ['polling', 'websocket'],
          autoConnect: true,
        });

        // Connection event handlers
        newSocket.on('connect', () => {
          console.log('Connected to socket server');
          setIsConnected(true);
          setError(null);
          
          // Authenticate user
          newSocket.emit('user:authenticate', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`.trim() || user.emailAddresses[0]?.emailAddress || 'Anonymous',
            userImage: user.imageUrl,
            email: user.emailAddresses[0]?.emailAddress || '',
          });
        });

        newSocket.on('disconnect', () => {
          console.log('Disconnected from socket server');
          setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setError('Failed to connect to server');
          setIsConnected(false);
        });

        // Room event handlers
        newSocket.on('room:created', (room) => {
          console.log('Room created:', room);
          setCurrentRoom(room);
          setParticipants(room.participants);
          setMessages([]);
          setIsLoading(false);
          router.push(`/room/${room.id}`);
        });

        newSocket.on('room:joined', (data) => {
          console.log('Room joined:', data.room);
          setCurrentRoom(data.room);
          setParticipants(data.room.participants);
          setMessages([]);
          setIsLoading(false);
          router.push(`/room/${data.room.id}`);
        });

        newSocket.on('room:error', (error) => {
          console.error('Room error:', error);
          setError(error);
          setIsLoading(false);
        });

        // Message event handlers
        newSocket.on('message:new', (message) => {
          console.log('New message:', message);
          setMessages(prev => [...prev, message]);
        });

        // User event handlers
        newSocket.on('user:joined', (participant) => {
          console.log('User joined:', participant);
          setParticipants(prev => {
            const exists = prev.find(p => p.userId === participant.userId);
            if (exists) {
              return prev.map(p => p.userId === participant.userId ? participant : p);
            }
            return [...prev, participant];
          });
        });

        newSocket.on('user:left', (userId) => {
          console.log('User left:', userId);
          setParticipants(prev => 
            prev.map(p => p.userId === userId ? { ...p, isOnline: false } : p)
          );
        });

        newSocket.on('user:typing', (data) => {
          setTypingUsers(prev => ({
            ...prev,
            [data.userId]: {
              userName: data.userName,
              timestamp: Date.now()
            }
          }));

          // Clear typing indicator after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => {
              const updated = { ...prev };
              delete updated[data.userId];
              return updated;
            });
          }, 3000);
        });

        newSocket.on('user:online', (userId) => {
          setParticipants(prev =>
            prev.map(p => p.userId === userId ? { ...p, isOnline: true } : p)
          );
        });

        newSocket.on('user:offline', (userId) => {
          setParticipants(prev =>
            prev.map(p => p.userId === userId ? { ...p, isOnline: false } : p)
          );
        });

        setSocket(newSocket);
      })
      .catch((error) => {
        console.error('Failed to initialize socket server:', error);
        setError('Failed to initialize connection');
      });

    // Cleanup function
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  }, [user, router]); // Only depend on user and router

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Action functions
  const createRoom = useCallback(async (name: string, maxParticipants?: number) => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    socket.emit('room:create', { name, maxParticipants });
  }, [socket, isConnected]);

  const joinRoom = useCallback(async (code: string) => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    socket.emit('room:join', { code });
  }, [socket, isConnected]);

  const leaveRoom = useCallback(() => {
    if (!socket || !currentRoom) return;

    socket.emit('room:leave', currentRoom.id);
    setCurrentRoom(null);
    setMessages([]);
    setParticipants([]);
    setTypingUsers({});
    router.push('/');
  }, [socket, currentRoom, router]);

  const sendMessage = useCallback((content: string) => {
    if (!socket || !currentRoom || !content.trim()) return;

    socket.emit('message:send', {
      roomId: currentRoom.id,
      content: content.trim(),
      type: 'text'
    });
  }, [socket, currentRoom]);

  const sendImage = useCallback((file: File) => {
    if (!socket || !currentRoom) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target?.result as string;
      socket.emit('image:upload', {
        roomId: currentRoom.id,
        image: base64Image,
        imageName: file.name,
        imageSize: file.size
      });
    };
    reader.readAsDataURL(file);
  }, [socket, currentRoom]);

  const sendFile = useCallback((file: File) => {
    if (!socket || !currentRoom) return;

    // TODO: Implement file upload
    console.log('File upload not implemented yet:', file.name);
  }, [socket, currentRoom]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!socket || !currentRoom) return;

    socket.emit('user:typing', {
      roomId: currentRoom.id,
      isTyping
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('user:typing', {
          roomId: currentRoom.id,
          isTyping: false
        });
      }, 3000);
    }
  }, [socket, currentRoom]);

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    if (!socket || !isConnected) return;

    const interval = setInterval(() => {
      socket.emit('user:ping');
    }, 30000);

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  const contextValue: RoomContextType = {
    socket,
    currentRoom,
    messages,
    participants,
    isConnected,
    isLoading,
    error,
    currentUserId: user?.id || null,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendImage,
    sendFile,
    setTyping,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketProvider; 