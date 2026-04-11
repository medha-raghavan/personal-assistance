import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;
  
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    'full': 'max-w-[95vw] md:max-w-4xl',
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/70" onClick={onClose} />
        
        <div className={`relative w-full ${sizeStyles[size]} bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-h-[95vh] flex flex-col`}>
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-3 sm:p-4 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
