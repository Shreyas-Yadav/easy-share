'use client';

import { useState } from 'react';
import { useSocket } from '../../../components/providers/SocketProvider';
import type { JoinRoomFormData } from '../../../types/room';

export default function JoinRoom() {
  const { joinRoom, isLoading, error, isConnected } = useSocket();
  const [formData, setFormData] = useState<JoinRoomFormData>({
    code: '',
  });
  const [formError, setFormError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      setFormError('Room code is required');
      return;
    }

    if (formData.code.trim().length !== 6) {
      setFormError('Room code must be 6 characters');
      return;
    }

    setFormError('');
    await joinRoom(formData.code.trim().toUpperCase());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Convert to uppercase and limit to 6 characters
    const cleanValue = value.toUpperCase().slice(0, 6);
    setFormData({ code: cleanValue });
    
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Join Room</h1>
          <p className="text-gray-600">
            Enter the room code to join an existing room
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Room Code
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="Enter 6-character code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-lg font-mono tracking-widest"
              disabled={isLoading}
              maxLength={6}
              autoComplete="off"
              required
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              Example: ABC123
            </p>
          </div>

          {(error || formError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error || formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !formData.code.trim() || formData.code.length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Joining Room...
              </>
            ) : (
              'Join Room'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <span className="h-2 w-2 bg-green-400 rounded-full"></span>
            <span>Connected to server</span>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="text-sm font-medium text-blue-800 mb-1">How to get a room code?</h3>
            <p className="text-xs text-blue-600">
              Ask the room creator to share their 6-character room code with you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}