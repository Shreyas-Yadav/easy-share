'use client';

import { useEffect, useRef } from 'react';

export interface BillData {
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    category?: string;
  }>;
  subtotal?: number;
  tax_amount?: number;
  tip_amount?: number;
  total_amount: number;
  restaurant_name?: string;
  date?: string;
}

interface BillExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  billData: BillData | null;
  imageName: string;
  isLoading: boolean;
  error: string | null;
}

export default function BillExtractionModal({
  isOpen,
  onClose,
  billData,
  imageName,
  isLoading,
  error
}: BillExtractionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'food':
        return '🍽️';
      case 'drink':
      case 'beverage':
        return '🥤';
      case 'dessert':
        return '🍰';
      case 'appetizer':
        return '🥗';
      default:
        return '🍽️';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'food':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'drink':
      case 'beverage':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'dessert':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'appetizer':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Group items by category for better organization
  const groupedItems = billData?.items.reduce((groups, item) => {
    const category = item.category || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, typeof billData.items>) || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />

        {/* Modal content */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl leading-6 font-bold text-white">
                  🧾 Bill Extraction Results
                </h3>
                <p className="text-indigo-100 text-sm mt-1">
                  📸 {imageName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-indigo-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-white px-6 py-6 max-h-96 overflow-y-auto">
            {/* Loading state */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
                <p className="mt-4 text-gray-600 text-lg">🔍 Extracting bill information...</p>
                <p className="text-sm text-gray-500 mt-2">Analyzing receipt with AI</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 rounded-md p-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-red-800">❌ Extraction Failed</h3>
                    <p className="text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bill data */}
            {billData && !isLoading && !error && (
              <div className="space-y-6">
                {/* Restaurant header */}
                {billData.restaurant_name && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">🏪</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-bold text-gray-900">{billData.restaurant_name}</h4>
                        {billData.date && (
                          <p className="text-sm text-gray-600">📅 {billData.date}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Items organized by category */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">📋 Order Items</h4>
                    <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                      {billData.items.length} items
                    </div>
                  </div>

                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Category header */}
                      <div className={`px-4 py-2 border-b border-gray-200 ${getCategoryColor(category)}`}>
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getCategoryIcon(category)}</span>
                          <span className="font-medium capitalize">
                            {category === 'other' ? 'Other Items' : category}
                          </span>
                          <span className="ml-2 text-sm opacity-75">({items.length})</span>
                        </div>
                      </div>

                      {/* Items in category */}
                      <div className="divide-y divide-gray-100">
                        {items.map((item, index) => (
                          <div key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 text-base">{item.name}</h5>
                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                                  <span className="flex items-center">
                                    <span className="font-medium">Qty:</span>
                                    <span className="ml-1 bg-gray-100 px-2 py-1 rounded">{item.quantity}</span>
                                  </span>
                                  <span className="flex items-center">
                                    <span className="font-medium">Unit:</span>
                                    <span className="ml-1">{formatCurrency(item.unit_price)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                  {formatCurrency(item.total_price)}
                                </div>
                                {item.quantity > 1 && (
                                  <div className="text-xs text-gray-500">
                                    {item.quantity} × {formatCurrency(item.unit_price)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">💰</span>
                    Payment Summary
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Items subtotal */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items Total:</span>
                      <span className="font-medium">
                        {formatCurrency(billData.items.reduce((sum, item) => sum + item.total_price, 0))}
                      </span>
                    </div>

                    {billData.subtotal && billData.subtotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(billData.subtotal)}</span>
                      </div>
                    )}

                    {billData.tax_amount && billData.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium">{formatCurrency(billData.tax_amount)}</span>
                      </div>
                    )}

                    {billData.tip_amount && billData.tip_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tip:</span>
                        <span className="font-medium">{formatCurrency(billData.tip_amount)}</span>
                      </div>
                    )}

                    <hr className="border-gray-300" />
                    
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Total Amount:</span>
                      <span className="text-green-600">{formatCurrency(billData.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {billData.items.length}
                    </div>
                    <div className="text-sm text-blue-800">Total Items</div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {billData.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                    <div className="text-sm text-green-800">Total Quantity</div>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(billData.items.reduce((max, item) => Math.max(max, item.total_price), 0))}
                    </div>
                    <div className="text-sm text-purple-800">Highest Item</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {billData && (
                <span>✨ Extracted using AI • {billData.items.length} items found</span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 