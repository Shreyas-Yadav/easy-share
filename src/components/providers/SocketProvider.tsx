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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
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
    if (!socket || !currentRoom || !content.trim()) {
      console.error('sendMessage failed:', {
        hasSocket: !!socket,
        hasCurrentRoom: !!currentRoom,
        hasContent: !!content.trim()
      });
      return;
    }

    console.log('=== SENDING TEXT MESSAGE ===');
    console.log('Message data:', {
      roomId: currentRoom.id,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      type: 'text',
      socketConnected: socket.connected,
      socketId: socket.id
    });

    socket.emit('message:send', {
      roomId: currentRoom.id,
      content: content.trim(),
      type: 'text'
    });

    console.log('Text message emitted successfully');
  }, [socket, currentRoom]);

  const sendImage = useCallback(async (file: File) => {
    if (!socket || !currentRoom || !user) {
      console.error('sendImage failed: missing requirements', { 
        hasSocket: !!socket, 
        hasCurrentRoom: !!currentRoom,
        hasUser: !!user,
        socketConnected: socket?.connected,
        socketId: socket?.id
      });
      return;
    }

    console.log('=== STARTING HTTP IMAGE UPLOAD ===');
    console.log('Upload data:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      roomId: currentRoom.id,
      userId: user.id
    });

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create FormData for HTTP upload
      const formData = new FormData();
      formData.append('image', file);
      formData.append('roomId', currentRoom.id);
      formData.append('userId', user.id);
      formData.append('userName', `${user.firstName} ${user.lastName}`.trim() || user.emailAddresses[0]?.emailAddress || 'Anonymous');
      formData.append('userImage', user.imageUrl);

      console.log('1. Uploading image via HTTP...');
      setUploadProgress(25);

      // Upload to HTTP endpoint
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      console.log('2. HTTP request completed, status:', response.status);
      setUploadProgress(75);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log('3. Upload successful, broadcasting message...');
      setUploadProgress(90);

      // Broadcast the image message via socket
      if (socket && result.message) {
        socket.emit('image:uploaded', {
          roomId: currentRoom.id,
          message: result.message
        });
      }

      console.log('4. SUCCESS: Image uploaded and message broadcasted');
      setUploadProgress(100);

      // Reset progress after short delay
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (error) {
      console.error('=== IMAGE UPLOAD ERROR ===');
      console.error('Upload error:', error);
      
      setError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [socket, currentRoom, user]);

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
    isUploading,
    uploadProgress,
    currentUserId: user?.id || null,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendImage,
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