'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { socketToast, roomToast, messageToast, userToast } from '@/services/ToastService';
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Room state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  
  // Typing state
  const [, setTypingUsers] = useState<TypingUsers>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

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
          socketToast.connectionEstablished();
          
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
          socketToast.connectionLost();
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setIsConnected(false);
          socketToast.connectionFailed();
        });

        // Room event handlers
        newSocket.on('room:created', (room) => {
          console.log('Room created:', room);
          setCurrentRoom(room);
          setParticipants(room.participants);
          setMessages([]);
          setIsLoading(false);
          roomToast.roomCreated(room.name, room.code);
          router.push(`/room/${room.id}`);
        });

        newSocket.on('room:joined', (data) => {
          console.log('Room joined:', data.room);
          setCurrentRoom(data.room);
          setParticipants(data.room.participants);
          setMessages([]);
          setIsLoading(false);
          roomToast.roomJoined(data.room.name);
          router.push(`/room/${data.room.id}`);
        });

        newSocket.on('room:error', (error) => {
          console.error('Room error:', error);
          setIsLoading(false);
          
          // Show specific error toasts based on error message
          if (error.toLowerCase().includes('not found')) {
            roomToast.roomNotFound();
          } else if (error.toLowerCase().includes('full')) {
            roomToast.roomFull();
          } else if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('room code')) {
            roomToast.invalidRoomCode();
          } else {
            roomToast.error(error);
          }
        });

        newSocket.on('room:deleted', (roomId) => {
          console.log('Room deleted:', roomId);
          if (currentRoom?.id === roomId) {
            setCurrentRoom(null);
            setMessages([]);
            setParticipants([]);
            roomToast.roomDeleted();
            router.push('/');
          }
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
          
          // Show user joined notification
          const userName = `${participant.firstName} ${participant.lastName}`.trim();
          userToast.userJoined(userName);
        });

        newSocket.on('user:left', (userId) => {
          console.log('User left:', userId);
          const leavingUser = participants.find(p => p.userId === userId);
          setParticipants(prev => 
            prev.map(p => p.userId === userId ? { ...p, isOnline: false } : p)
          );
          
          // Show user left notification
          if (leavingUser) {
            const userName = `${leavingUser.firstName} ${leavingUser.lastName}`.trim();
            userToast.userLeft(userName);
          }
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
        socketToast.connectionFailed();
      });

    // Cleanup function
    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]); // Only depend on user and router

  // Detect user logout and perform cleanup
  useEffect(() => {
    // If we had a user before but now we don't, it means logout occurred
    if (previousUserIdRef.current && !user) {
      console.log('=== USER LOGOUT DETECTED ===');
      console.log('Previous user ID:', previousUserIdRef.current);
      
      // Emit logout event to socket server first (if connected)
      if (socket && socket.connected) {
        console.log('Notifying socket server of logout...');
        socket.emit('user:logout', previousUserIdRef.current);
      }
      
      // Perform logout cleanup via API
      const performLogoutCleanup = async () => {
        try {
          const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: previousUserIdRef.current
            })
          });

          if (!response.ok) {
            console.error('Logout cleanup failed:', await response.text());
          } else {
            console.log('Logout cleanup completed successfully');
          }
        } catch (error) {
          console.error('Error during logout cleanup:', error);
        }
      };

      performLogoutCleanup();
      
      // Clear local state
      setCurrentRoom(null);
      setMessages([]);
      setParticipants([]);
      setTypingUsers({});
      
      // Disconnect socket if connected
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
    
    // Update previous user ID
    previousUserIdRef.current = user?.id || null;
  }, [user, socket]);

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
      socketToast.connectionFailed();
      return;
    }

    setIsLoading(true);
    
    socket.emit('room:create', { name, maxParticipants });
  }, [socket, isConnected]);

  const joinRoom = useCallback(async (code: string) => {
    if (!socket || !isConnected) {
      socketToast.connectionFailed();
      return;
    }

    setIsLoading(true);
    
    socket.emit('room:join', { code });
  }, [socket, isConnected]);

  const leaveRoom = useCallback(() => {
    if (!socket || !currentRoom) return;

    socket.emit('room:leave', currentRoom.id);
    setCurrentRoom(null);
    setMessages([]);
    setParticipants([]);
    setTypingUsers({});
    roomToast.roomLeft();
    router.push('/');
  }, [socket, currentRoom, router]);

  const deleteRoom = useCallback(() => {
    if (!socket || !currentRoom) return;

    console.log('=== DELETING ROOM ===');
    console.log('Requesting deletion of room:', currentRoom.id);

    // Create a promise-based approach to handle the deletion result
    const deletePromise = new Promise<void>((resolve, reject) => {
      // Set up temporary listeners for this deletion
      const handleSuccess = (deletedRoomId: string) => {
        if (deletedRoomId === currentRoom.id) {
          console.log('Room deletion successful, redirecting creator to dashboard');
          // Clean up local state
          setCurrentRoom(null);
          setMessages([]);
          setParticipants([]);
          // Redirect to dashboard
          router.push('/');
          resolve();
        }
      };

      const handleError = (error: string) => {
        console.error('Room deletion failed:', error);
        roomToast.error(error);
        reject(new Error(error));
      };

      // Listen for success or error
      socket.once('room:deleted', handleSuccess);
      socket.once('room:error', handleError);

      // Clean up listeners after 10 seconds to prevent memory leaks
      setTimeout(() => {
        socket.off('room:deleted', handleSuccess);
        socket.off('room:error', handleError);
        reject(new Error('Delete request timeout'));
      }, 10000);
    });

    // Emit the delete request
    socket.emit('room:delete', {
      roomId: currentRoom.id
    });

    // Handle the promise (optional - for error logging)
    deletePromise.catch((error) => {
      console.error('Delete room operation failed:', error);
    });
  }, [socket, currentRoom, router]);

  const sendMessage = useCallback((content: string) => {
    if (!socket || !currentRoom || !content.trim()) {
      console.error('sendMessage failed:', {
        hasSocket: !!socket,
        hasCurrentRoom: !!currentRoom,
        hasContent: !!content.trim()
      });
      
      if (!socket || !socket.connected) {
        messageToast.messageSendFailed();
        socketToast.connectionFailed();
      }
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
      
      if (!socket || !socket.connected) {
        messageToast.imageUploadFailed('Not connected to server');
        socketToast.connectionFailed();
      } else {
        messageToast.imageUploadFailed();
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      messageToast.invalidFileType();
      return;
    }

    // Validate file size (3MB limit)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      messageToast.fileTooLarge('3MB');
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
    
    // Show upload started toast
    const uploadToastId = messageToast.imageUploadStarted();

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

      // Update the upload toast to success
      messageToast.update(uploadToastId, { 
        render: 'Image uploaded successfully!', 
        type: 'success' 
      });

      // Reset progress after short delay
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (error) {
      console.error('=== IMAGE UPLOAD ERROR ===');
      console.error('Upload error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setIsUploading(false);
      setUploadProgress(0);
      
      // Update the upload toast to error
      messageToast.update(uploadToastId, { 
        render: errorMessage, 
        type: 'error' 
      });
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
    isUploading,
    uploadProgress,
    currentUserId: user?.id || null,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
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