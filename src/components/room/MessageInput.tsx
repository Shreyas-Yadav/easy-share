'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../providers/SocketProvider';

export default function MessageInput() {
  const { sendMessage, sendImage, setTyping, currentRoom, isUploading, uploadProgress, error } = useSocket();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !currentRoom) return;

    sendMessage(message.trim());
    setMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      setTyping(false);
      setIsTyping(false);
    }

    // Focus back on the textarea
    textareaRef.current?.focus();
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicator
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      setTyping(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        setTyping(false);
      }
    }, 2000);

    // Stop typing if input is empty
    if (!value.trim() && isTyping) {
      setIsTyping(false);
      setTyping(false);
    }
  }, [isTyping, setTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Handle image file selection
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected in image upload');
      return;
    }

    console.log('Image upload triggered from MessageInput:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type selected:', file.type);
      alert('Please select an image file');
      return;
    }

    // Validate file size (3MB limit for Base64 conversion)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size, 'bytes. Max:', maxSize);
      alert('Image size must be less than 3MB');
      return;
    }

    console.log('File validation passed, calling sendImage...');
    await sendImage(file);
    
    // Reset the input
    event.target.value = '';
  };

  const triggerImageUpload = () => {
    if (isUploading) return; // Prevent multiple uploads
    fileInputRef.current?.click();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!currentRoom) return null;

  return (
    <div className="p-4 bg-white">
      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="mb-3 bg-gray-100 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Uploading image...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !isUploading && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* Message Input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
            disabled={isUploading}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || isUploading}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>

      {/* Hidden file input - ONLY for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        disabled={isUploading}
      />

      {/* Action buttons and info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          {/* ONLY Image Upload Button */}
          <button
            type="button"
            onClick={triggerImageUpload}
            disabled={isUploading}
            className={`p-2 rounded-lg transition-colors ${
              isUploading 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'
            }`}
            title={isUploading ? 'Uploading...' : 'Upload image'}
          >
            {isUploading ? (
              <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-indigo-600 rounded-full"></div>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          
          <span className="text-sm text-gray-500">
            {isUploading 
              ? 'Uploading image...' 
              : 'Click to upload image (max 3MB) • Press Enter to send message'
            }
          </span>
        </div>

        {/* Character count */}
        <div className="text-xs text-gray-400">
          {message.length > 800 && (
            <span className={message.length > 1000 ? 'text-red-500' : 'text-orange-500'}>
              {message.length}/1000
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 