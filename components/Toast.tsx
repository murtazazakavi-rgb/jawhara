'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, message, type, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep at most 4 toasts visible

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );
  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );
  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );
  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast Notification Container */}
      <div 
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:right-6 z-[120] flex flex-col gap-2.5 max-w-sm pointer-events-none select-none"
      >
        {toasts.map((t) => {
          const typeStyles = {
            success: {
              bg: 'bg-[#FAF8F6] border-[#ad899b]/40 text-[#1b1c1b]',
              icon: 'check_circle',
              iconColor: 'text-primary',
              bar: 'bg-primary',
            },
            error: {
              bg: 'bg-[#fff5f5] border-[#ffdad6] text-[#93000a]',
              icon: 'error',
              iconColor: 'text-[#ba1a1a]',
              bar: 'bg-[#ba1a1a]',
            },
            warning: {
              bg: 'bg-[#fffaf0] border-[#fee7b8] text-[#8a5b00]',
              icon: 'warning',
              iconColor: 'text-[#b7791f]',
              bar: 'bg-[#d69e2e]',
            },
            info: {
              bg: 'bg-[#FAF8F6] border-outline-variant/30 text-on-surface',
              icon: 'info',
              iconColor: 'text-secondary',
              bar: 'bg-secondary',
            },
          }[t.type];

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md animate-toast-in overflow-hidden relative ${typeStyles.bg}`}
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1 ${typeStyles.bar}`} />
              <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ml-1 ${typeStyles.iconColor}`}>
                {typeStyles.icon}
              </span>
              <p className="font-body-md text-xs leading-relaxed flex-grow pr-2 font-medium">
                {t.message}
              </p>
              <button
                onClick={() => removeToast(t.id)}
                className="text-outline-variant hover:text-on-surface cursor-pointer shrink-0 p-0.5 rounded-full"
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
