'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '../../../../components/providers/SocketProvider';
import MessageList from '@/components/room/MessageList';
import MessageInput from '@/components/room/MessageInput';
import ParticipantsList from '@/components/room/ParticipantsList';
import RoomHeader from '@/components/room/RoomHeader';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { currentRoom, messages, participants, isConnected, leaveRoom } = useSocket();
  const [showParticipants, setShowParticipants] = useState(false);
  
  const roomId = params.roomId as string;

  useEffect(() => {
    // If user is not in a room or in wrong room, redirect
    if (isConnected && (!currentRoom || currentRoom.id !== roomId)) {
      router.push('/');
    }
  }, [currentRoom, roomId, router, isConnected]);

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Connecting...</h2>
          <p className="text-gray-600">Establishing connection to the server</p>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Room not found</h2>
          <p className="text-gray-600 mb-4">The room you&apos;re looking for doesn&apos;t exist or you&apos;re not a member.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-200 flex flex-col">
      {/* Room Header */}
      <RoomHeader 
        room={currentRoom}
        participantCount={participants.filter(p => p.isOnline).length}
        onLeaveRoom={handleLeaveRoom}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <MessageList messages={messages} />
          </div>

          {/* Message Input */}
          <div className="flex-shrink-0 border-t border-gray-200">
            <MessageInput />
          </div>
        </div>

        {/* Participants Sidebar - Desktop */}
        <div className="hidden lg:block w-80 bg-gray-50 border-l border-gray-200">
          <ParticipantsList participants={participants} />
        </div>
      </div>

      {/* Participants Sidebar - Mobile Overlay */}
      {showParticipants && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="flex-1 bg-black bg-opacity-50" 
            onClick={() => setShowParticipants(false)}
          />
          <div className="w-80 bg-gray-50 h-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Participants</h2>
              <button
                onClick={() => setShowParticipants(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Close participants"
              >
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ParticipantsList participants={participants} showHeader={false} />
          </div>
        </div>
      )}
    </div>
  );
} 