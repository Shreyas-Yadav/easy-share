'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ isVisible, position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  const handleItemClick = (e: React.MouseEvent, item: ContextMenuItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!item.disabled) {
      item.onClick();
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={(e) => handleItemClick(e, item)}
          disabled={item.disabled}
          className={`w-full flex items-center px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
            item.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          <span className="mr-3 flex-shrink-0">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
} 