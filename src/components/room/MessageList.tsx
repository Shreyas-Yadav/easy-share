'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '../../types/room';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (timestamp: Date) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage?: Message) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    
    return currentDate !== previousDate;
  };

  const shouldShowUserInfo = (currentMessage: Message, previousMessage?: Message) => {
    if (!previousMessage) return true;
    if (currentMessage.userId !== previousMessage.userId) return true;
    
    // Show user info if messages are more than 5 minutes apart
    const timeDiff = new Date(currentMessage.timestamp).getTime() - new Date(previousMessage.timestamp).getTime();
    return timeDiff > 5 * 60 * 1000; // 5 minutes
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No messages yet</h3>
          <p className="text-gray-500">Send the first message to get the conversation started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((message, index) => {
        const previousMessage = index > 0 ? messages[index - 1] : undefined;
        const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
        const showUserInfo = shouldShowUserInfo(message, previousMessage);

        return (
          <div key={message.id}>
            {/* Date Separator */}
            {showDateSeparator && (
              <div className="flex justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {formatDate(message.timestamp)}
                </div>
              </div>
            )}

            {/* Message */}
            <div className={`flex items-start space-x-3 ${showUserInfo ? 'mt-4' : 'mt-1'}`}>
              {/* Avatar */}
              {showUserInfo ? (
                <div className="flex-shrink-0">
                  {message.type === 'system' ? (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : message.userImage ? (
                    <img
                      src={message.userImage}
                      alt={message.userName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {message.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-8" /> // Spacer for alignment
              )}

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                {showUserInfo && (
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-sm font-medium ${
                      message.type === 'system' ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {message.userName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                )}

                <div className={`rounded-lg px-3 py-2 max-w-4xl ${
                  message.type === 'system' 
                    ? 'bg-blue-50 text-blue-800 text-sm italic'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.edited && (
                    <span className="text-xs text-gray-500 ml-2">(edited)</span>
                  )}
                </div>

                {!showUserInfo && (
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-gray-400">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
} 