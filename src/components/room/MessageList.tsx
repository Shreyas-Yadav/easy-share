'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSocket } from '../providers/SocketProvider';
import type { Message, ImageMessage } from '../../types/room';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  const { currentUserId } = useSocket();
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
        const isOwnMessage = message.userId === currentUserId;
        const isSystemMessage = message.type === 'system';

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

            {/* System Message */}
            {isSystemMessage ? (
              <div className="flex justify-center my-2">
                <div className="bg-blue-50 text-blue-800 text-sm px-3 py-1 rounded-full italic flex items-center space-x-2">
                  <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{message.content}</span>
                </div>
              </div>
            ) : (
              /* Regular Messages */
              <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${showUserInfo ? 'mt-4' : 'mt-1'}`}>
                <div className={`flex max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl ${
                  isOwnMessage ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'
                }`}>
                  {/* Avatar */}
                  {showUserInfo && !isOwnMessage && (
                    <div className="flex-shrink-0">
                      {message.userImage ? (
                        <Image
                          src={message.userImage}
                          alt={message.userName}
                          width={32}
                          height={32}
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
                  )}

                  {!showUserInfo && !isOwnMessage && <div className="w-8" />}

                  {/* Message Content */}
                  <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
                    {showUserInfo && !isOwnMessage && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {message.userName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    )}

                    <div className={`inline-block rounded-lg max-w-full ${
                      message.type === 'image' 
                        ? 'p-1' 
                        : `px-3 py-2 ${isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`
                    }`}>
                      {message.type === 'image' ? (
                        <div className="space-y-2">
                          <div 
                            className="cursor-pointer inline-block max-w-xs max-h-64"
                            onClick={() => window.open((message as ImageMessage).imageUrl, '_blank')}
                          >
                            <Image 
                              src={(message as ImageMessage).imageUrl} 
                              alt={(message as ImageMessage).imageName}
                              width={300}
                              height={256}
                              className="rounded-lg object-cover w-auto h-auto max-w-full max-h-64"
                            />
                          </div>
                          <div className={`text-xs px-2 pb-1 ${
                            isOwnMessage ? 'text-indigo-200' : 'text-gray-500'
                          }`}>
                            {(message as ImageMessage).imageName}
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap break-words text-left">{message.content}</p>
                          {message.edited && (
                            <span className={`text-xs ml-2 ${
                              isOwnMessage ? 'text-indigo-200' : 'text-gray-500'
                            }`}>
                              (edited)
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Timestamp for own messages or when user info is not shown */}
                    {(isOwnMessage || !showUserInfo) && (
                      <div className={`mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        <span className="text-xs text-gray-400">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Own message avatar placeholder */}
                  {showUserInfo && isOwnMessage && <div className="w-8" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
} 