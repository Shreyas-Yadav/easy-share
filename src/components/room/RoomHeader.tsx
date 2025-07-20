'use client';

import { useState } from 'react';
import { useSocket } from '../providers/SocketProvider';
import type { Room } from '../../types/room';

interface RoomHeaderProps {
  room: Room;
  participantCount: number;
  onLeaveRoom: () => void;
  onToggleParticipants: () => void;
}

export default function RoomHeader({ 
  room, 
  participantCount, 
  onLeaveRoom, 
  onToggleParticipants 
}: RoomHeaderProps) {
  const { deleteRoom, currentUserId } = useSocket();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Check if current user is the room creator
  const isRoomCreator = currentUserId === room.createdBy;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleShareRoom = () => {
    copyToClipboard(room.code);
  };

  const handleDeleteRoom = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRoom = () => {
    console.log('User confirmed room deletion');
    deleteRoom();
    setShowDeleteConfirm(false);
  };

  const cancelDeleteRoom = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Room Info */}
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{room.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>Code: {room.code}</span>
                <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Share Room Button */}
            <button
              onClick={handleShareRoom}
              className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Copy room code"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Participants Toggle */}
            <button
              onClick={onToggleParticipants}
              className="lg:hidden text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Show participants"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {/* Delete Room Button (Only for Room Creator) */}
            {isRoomCreator && (
              <button
                onClick={handleDeleteRoom}
                className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete room"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {/* Leave Room Button */}
            <button
              onClick={onLeaveRoom}
              className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Leave room"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Room</h3>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <strong>{room.name}</strong>? This action cannot be undone and will:
              </p>
              <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Remove all participants from the room</li>
                <li>Delete all messages permanently</li>
                <li>Delete all uploaded images</li>
                <li>Remove the room completely</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={cancelDeleteRoom}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 