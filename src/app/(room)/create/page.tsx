'use client';

import { useState } from 'react';
import { useSocket } from '../../../components/providers/SocketProvider';
import type { CreateRoomFormData } from '../../../types/room';

export default function CreateRoom() {
  const { createRoom, isLoading, error, isConnected } = useSocket();
  const [formData, setFormData] = useState<CreateRoomFormData>({
    name: '',
    maxParticipants: 10,
  });
  const [formError, setFormError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setFormError('Room name is required');
      return;
    }

    if (formData.maxParticipants < 2 || formData.maxParticipants > 100) {
      setFormError('Maximum participants must be between 2 and 100');
      return;
    }

    setFormError('');
    await createRoom(formData.name.trim(), formData.maxParticipants);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxParticipants' ? parseInt(value) || 0 : value
    }));
    
    // Clear errors when user starts typing
    if (formError) setFormError('');
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

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Create Room</h1>
          <p className="text-gray-600">
            Create a new room to share files and chat with others
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Room Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter room name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Participants
            </label>
            <input
              type="number"
              id="maxParticipants"
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleInputChange}
              min="2"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Between 2 and 100 participants (default: 10)
            </p>
          </div>

          {(error || formError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error || formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !formData.name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Room...
              </>
            ) : (
              'Create Room'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="h-2 w-2 bg-green-400 rounded-full"></span>
            <span>Connected to server</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Once created, you'll get a room code to share with others
          </p>
        </div>
      </div>
    </div>
  );
}