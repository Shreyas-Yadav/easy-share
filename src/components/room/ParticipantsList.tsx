'use client';

import Image from 'next/image';
import type { RoomParticipant } from '../../types/room';

interface ParticipantsListProps {
  participants: RoomParticipant[];
  showHeader?: boolean;
}

export default function ParticipantsList({ participants, showHeader = true }: ParticipantsListProps) {
  const onlineParticipants = participants.filter(p => p.isOnline);
  const offlineParticipants = participants.filter(p => !p.isOnline);

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const ParticipantItem = ({ participant }: { participant: RoomParticipant }) => (
    <div className="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {participant.imageUrl && participant.imageUrl.trim() !== '' ? (
          <Image
            src={participant.imageUrl}
            alt={`${participant.firstName} ${participant.lastName}`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-sm font-medium text-indigo-600">
              {participant.firstName.charAt(0).toUpperCase()}
              {participant.lastName?.charAt(0)?.toUpperCase() || ''}
            </span>
          </div>
        )}
        
        {/* Online status indicator */}
        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
          participant.isOnline ? 'bg-green-400' : 'bg-gray-300'
        }`} />
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {participant.firstName} {participant.lastName}
          </p>
          {participant.isOnline && (
            <span className="text-xs text-green-600 font-medium">online</span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{participant.email}</p>
        {!participant.isOnline && (
          <p className="text-xs text-gray-400">
            Last seen {formatLastSeen(participant.lastSeen)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Participants ({participants.length})
          </h2>
          <p className="text-sm text-gray-600">
            {onlineParticipants.length} online, {offlineParticipants.length} offline
          </p>
        </div>
      )}

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto">
        {/* Online Participants */}
        {onlineParticipants.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="h-2 w-2 bg-green-400 rounded-full mr-2"></span>
              Online ({onlineParticipants.length})
            </h3>
            <div className="space-y-1">
              {onlineParticipants.map(participant => (
                <ParticipantItem key={participant.userId} participant={participant} />
              ))}
            </div>
          </div>
        )}

        {/* Offline Participants */}
        {offlineParticipants.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="h-2 w-2 bg-gray-300 rounded-full mr-2"></span>
              Offline ({offlineParticipants.length})
            </h3>
            <div className="space-y-1">
              {offlineParticipants.map(participant => (
                <ParticipantItem key={participant.userId} participant={participant} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {participants.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No participants</h3>
              <p className="text-gray-500 text-sm">Share the room code to invite others</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center">
            <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-2"></span>
            Online and active
          </div>
          <div className="flex items-center">
            <span className="h-1.5 w-1.5 bg-gray-300 rounded-full mr-2"></span>
            Recently left or offline
          </div>
        </div>
      </div>
    </div>
  );
} 