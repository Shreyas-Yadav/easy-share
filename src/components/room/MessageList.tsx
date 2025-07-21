'use client';

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import type { Message } from '../../types/room';
import type { BillExtraction } from '../../types/models';
import { useSocket } from '../providers/SocketProvider';
import ContextMenu from '../ui/ContextMenu';
import type { ContextMenuItem } from '../ui/ContextMenu';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  const { currentUserId, participants, currentRoom } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    imageUrl: string;
    imageName: string;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    imageUrl: '',
    imageName: '',
  });

  // Bill data state for table display
  const [billData, setBillData] = useState<BillExtraction['billData'] | { error: string } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [persistedBills, setPersistedBills] = useState<BillExtraction[]>([]);
  const [currentBillId, setCurrentBillId] = useState<string | null>(null);
  
  // Bill splitting state - tracks which users are assigned to each item
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({});

  // Get online participants for bill splitting
  const onlineParticipants = participants.filter(p => p.isOnline);

  // Load persisted bills when room changes
  useEffect(() => {
    const loadRoomBills = async () => {
      if (!currentRoom?.id) return;
      
      // setIsLoadingBills(true); // This state variable was removed, so this line is removed.
      try {
        console.log('Loading persisted bills for room:', currentRoom.id);
        const response = await fetch(`/api/room-bills?roomId=${currentRoom.id}`);
        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log('Loaded persisted bills:', result.data);
          setPersistedBills(result.data || []);
        } else {
          console.error('Failed to load bills:', result.error);
        }
      } catch (error) {
        console.error('Error loading bills:', error);
      } finally {
        // setIsLoadingBills(false); // This state variable was removed, so this line is removed.
      }
    };

    loadRoomBills();
  }, [currentRoom?.id]);

  // Save bill assignments to database
  const saveBillAssignments = async (billId: string, assignments: Record<number, string[]>) => {
    if (!currentUserId) return;
    
    try {
      console.log('Saving bill assignments:', { billId, assignments });
      const response = await fetch('/api/room-bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billId,
          itemAssignments: assignments,
          userId: currentUserId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Failed to save bill assignments:', result.error);
      } else {
        console.log('Bill assignments saved successfully');
        // Update the persisted bills list
        setPersistedBills(prev => 
          prev.map(bill => 
            bill.id === billId 
              ? { ...bill, itemAssignments: assignments, updatedAt: new Date() }
              : bill
          )
        );
      }
    } catch (error) {
      console.error('Error saving bill assignments:', error);
    }
  };

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

  // Context menu handlers
  const handleImageRightClick = (
    e: React.MouseEvent, 
    imageUrl: string, 
    imageName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      imageUrl,
      imageName,
    });
  };

  const handleImageClick = (imageUrl: string) => {
    // Only open if context menu is not visible
    if (!contextMenu.isVisible) {
      window.open(imageUrl, '_blank');
    }
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  // Close context menu when clicking outside or on background
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isVisible) {
        closeContextMenu();
      }
    };

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
        if (billData) {
          setBillData(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [contextMenu.isVisible, billData]);

  const handleExtractBill = async (e?: React.MouseEvent) => {
    console.log('🔍 handleExtractBill called');
    
    if (e) {
      console.log('🛑 Preventing default and stopping propagation');
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('📷 Extracting bill from:', contextMenu.imageUrl);
    console.log('📁 Image name:', contextMenu.imageName);
    
    // Close context menu first
    closeContextMenu();
    
    // Set extracting state
    setIsExtracting(true);
    setBillData(null);

    try {
      console.log('📡 Making API request to /api/extract-bill');
      
      // Get current user info from participants
      const currentUser = participants.find(p => p.userId === currentUserId);
      
      const response = await fetch('/api/extract-bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: contextMenu.imageUrl,
          imageName: contextMenu.imageName,
          userId: currentUserId,
          userName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Unknown User',
          userImage: currentUser?.imageUrl || '',
          roomId: currentRoom?.id,
        }),
      });

      console.log('📡 API response status:', response.status);
      const result = await response.json();
      console.log('📡 API response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract bill');
      }

      console.log('✅ Bill extraction successful and saved to database');
      
      // The result.data now contains the full BillExtraction object
      const billExtraction = result.data;
      
      // Set the bill data for display (using billData format for UI compatibility)
      setBillData(billExtraction.billData);
      
      // Set the current bill ID for future assignment saves
      setCurrentBillId(billExtraction.id);
      
      // Set existing assignments if any
      setItemAssignments(billExtraction.itemAssignments || {});
      
      // Add to persisted bills list
      setPersistedBills(prev => [billExtraction, ...prev]);
      
      setIsExtracting(false);

    } catch (error) {
      console.error('❌ Bill extraction error:', error);
      setIsExtracting(false);
      setBillData({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const closeBillData = () => {
    setBillData(null);
    setItemAssignments({});
    setCurrentBillId(null); // Reset current bill ID
  };

  // Handle checkbox changes for item assignments
  const handleItemAssignment = (itemIndex: number, userId: string, isChecked: boolean) => {
    setItemAssignments(prev => {
      const currentAssignments = prev[itemIndex] || [];
      let newAssignments;
      
      if (isChecked) {
        // Add user to this item if not already assigned
        if (!currentAssignments.includes(userId)) {
          newAssignments = {
            ...prev,
            [itemIndex]: [...currentAssignments, userId]
          };
        } else {
          return prev; // No change needed
        }
      } else {
        // Remove user from this item
        newAssignments = {
          ...prev,
          [itemIndex]: currentAssignments.filter(id => id !== userId)
        };
      }
      
      // Save to database if we have a current bill ID
      if (currentBillId) {
        saveBillAssignments(currentBillId, newAssignments);
      }
      
      return newAssignments;
    });
  };

  // Calculate split amounts for each user
  const calculateUserTotals = () => {
    const userTotals: Record<string, number> = {};
    
    // Initialize all participants with 0
    onlineParticipants.forEach(participant => {
      userTotals[participant.userId] = 0;
    });
    
    // Calculate split for each item only if billData is valid and has items
    if (billData && 'items' in billData && billData.items) {
      billData.items.forEach((item, index) => {
        const assignedUsers = itemAssignments[index] || [];
        if (assignedUsers.length > 0) {
          const splitAmount = item.total_price / assignedUsers.length;
          assignedUsers.forEach(userId => {
            userTotals[userId] += splitAmount;
          });
        }
      });
    }
    
    return userTotals;
  };

  // (Removed unused getUserName function)

  // Display a persisted bill
  const displayPersistedBill = (billExtraction: BillExtraction) => {
    setBillData(billExtraction.billData);
    setCurrentBillId(billExtraction.id);
    setItemAssignments(billExtraction.itemAssignments || {});
  };

  // Toggle all participants for a specific item
  const toggleAllParticipants = (itemIndex: number) => {
    const currentAssignments = itemAssignments[itemIndex] || [];
    const allUserIds = onlineParticipants.map(p => p.userId);
    
    // If all are selected, deselect all. Otherwise, select all.
    const shouldSelectAll = currentAssignments.length !== allUserIds.length;
    
    const newAssignments = {
      ...itemAssignments,
      [itemIndex]: shouldSelectAll ? allUserIds : []
    };
    
    setItemAssignments(newAssignments);
    
    // Save to database if we have a current bill ID
    if (currentBillId) {
      saveBillAssignments(currentBillId, newAssignments);
    }
  };

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'extract-bill',
      label: 'Extract Bill',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: handleExtractBill,
    },
    {
      id: 'open-full-size',
      label: 'Open Full Size',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      ),
      onClick: () => window.open(contextMenu.imageUrl, '_blank'),
    },
  ];

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
    <div className="h-full overflow-y-auto p-4 pb-4 space-y-1">
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
                      {message.userImage && message.userImage.trim() !== '' ? (
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
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              onClick={() => handleImageClick((message as any).imageUrl)}
                              onContextMenu={(e) => handleImageRightClick(
                                e, 
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (message as any).imageUrl, 
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (message as any).imageName
                              )}
                            >
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {(message as any).imageUrl && (message as any).imageUrl.trim() !== '' ? (
                                <Image 
                                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                  src={(message as any).imageUrl} 
                                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                  alt={(message as any).imageName}
                                width={300}
                                height={256}
                                className="rounded-lg object-cover w-auto h-auto max-w-full max-h-64"
                              />
                            ) : (
                              <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-500">Image not available</span>
                              </div>
                            )}
                          </div>
                          <div className={`text-xs px-2 pb-1 ${
                            isOwnMessage ? 'text-indigo-200' : 'text-gray-500'
                          }`}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(message as any).imageName}
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
      <div ref={messagesEndRef} className="h-4" />
      
      {/* Loading state for bill extraction */}
      {isExtracting && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-blue-800">🔍 Extracting bill information...</span>
          </div>
        </div>
      )}

      {/* Persisted Bills Section */}
      {persistedBills.length > 0 && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-3">💾 Previous Extractions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Restaurant
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {persistedBills.map(bill => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                                         <td className="px-3 py-2 text-sm text-gray-900">
                       {formatDate(new Date(bill.extractedAt))}
                     </td>
                     <td className="px-3 py-2 text-sm text-gray-900">
                       {bill.billData?.restaurant_name || 'N/A'}
                     </td>
                     <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                       ${bill.billData?.total_amount?.toFixed(2) || '0.00'}
                     </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => displayPersistedBill(bill)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Data Table */}
      {billData && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          {'error' in billData ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">❌ Extraction Failed</h3>
                  <p className="text-sm text-red-700 mt-1">{billData.error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">🧾 Bill Extraction Results</h3>
                <button
                  onClick={closeBillData}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

                                {/* Restaurant Info */}
                  {('restaurant_name' in billData && (billData.restaurant_name || billData.date)) && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      {billData.restaurant_name && (
                        <p className="font-medium text-green-800">🏪 {billData.restaurant_name}</p>
                      )}
                      {billData.date && (
                        <p className="text-sm text-green-700">📅 {billData.date}</p>
                      )}
                    </div>
                  )}

                  {/* Items Table */}
                  {'items' in billData && billData.items && billData.items.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">📋 Items ({billData.items.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Price
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          {/* Participant columns */}
                          {onlineParticipants.map(participant => (
                            <th key={participant.userId} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex flex-col items-center space-y-1">
                                {participant.imageUrl ? (
                                  <img
                                    src={participant.imageUrl}
                                    alt={participant.firstName}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <span className="text-xs font-medium text-indigo-600">
                                      {participant.firstName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span className="text-xs text-gray-700 leading-tight">
                                  {participant.firstName}
                                </span>
                              </div>
                            </th>
                          ))}
                          {/* Actions column */}
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {billData.items.map((item: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div>{item.name}</div>
                              {item.category && (
                                <div className="text-xs text-gray-500">{item.category}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-center">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">
                              ${item.unit_price?.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                              ${item.total_price?.toFixed(2)}
                            </td>
                            {/* Participant checkboxes */}
                            {onlineParticipants.map(participant => (
                              <td key={participant.userId} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={itemAssignments[index]?.includes(participant.userId) || false}
                                  onChange={(e) => handleItemAssignment(index, participant.userId, e.target.checked)}
                                  className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                                />
                              </td>
                            ))}
                            {/* Select All helper */}
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => toggleAllParticipants(index)}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                              >
                                {itemAssignments[index]?.length === onlineParticipants.length ? 'Deselect All' : 'Select All'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* User Split Summary */}
              {onlineParticipants.length > 0 && Object.keys(itemAssignments).length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">👥 Split Summary</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {onlineParticipants.map(participant => {
                        const userTotal = calculateUserTotals()[participant.userId] || 0;
                        return (
                          <div key={participant.userId} className="flex items-center justify-between bg-white rounded-md p-3 border border-gray-200">
                            <div className="flex items-center space-x-2">
                              {participant.imageUrl ? (
                                <img
                                  src={participant.imageUrl}
                                  alt={participant.firstName}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-indigo-600">
                                    {participant.firstName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {participant.firstName} {participant.lastName}
                              </span>
                            </div>
                            <span className={`text-sm font-bold ${userTotal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              ${userTotal.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Total validation */}
                    <div className="mt-4 pt-3 border-t border-blue-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-700 font-medium">Total Assigned:</span>
                        <span className="font-bold text-blue-800">
                          ${Object.values(calculateUserTotals()).reduce((sum, amount) => sum + amount, 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-blue-700 font-medium">Bill Total:</span>
                        <span className="font-bold text-blue-800">
                          ${billData.total_amount?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-md p-3">
                <h4 className="font-medium text-gray-900 mb-2">💰 Summary</h4>
                <div className="space-y-1 text-sm">
                  {billData.subtotal && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">${billData.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.tax_amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">${billData.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.tip_amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tip:</span>
                      <span className="font-medium">${billData.tip_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <hr className="my-2" />
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-green-600">${billData.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Context Menu */}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />
    </div>
  );
} 