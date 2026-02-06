'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Link from 'next/link';

// ===========================
// Types
// ===========================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
    label: string;
    href?: string;
    onClick?: () => void;
}

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: ToastAction;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => void;
    error: (title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => void;
    warning: (title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => void;
    info: (title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => void;
}

// ===========================
// Context
// ===========================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ===========================
// Provider
// ===========================

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = {
            id,
            duration: DEFAULT_DURATION,
            ...toast,
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto-remove after duration
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, newToast.duration);
        }
    }, [removeToast]);

    const success = useCallback((title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => {
        addToast({ type: 'success', title, message, ...options });
    }, [addToast]);

    const error = useCallback((title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => {
        addToast({ type: 'error', title, message, duration: 8000, ...options }); // Errors stay longer
    }, [addToast]);

    const warning = useCallback((title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => {
        addToast({ type: 'warning', title, message, ...options });
    }, [addToast]);

    const info = useCallback((title: string, message?: string, options?: { action?: ToastAction, duration?: number }) => {
        addToast({ type: 'info', title, message, ...options });
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// ===========================
// Hook
// ===========================

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// ===========================
// Toast Container Component
// ===========================

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

// ===========================
// Individual Toast Component
// ===========================

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 200);
    };

    const icons = {
        success: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        warning: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    };

    const colors = {
        success: 'bg-emerald-50 border-emerald-500 text-emerald-800',
        error: 'bg-rose-50 border-rose-500 text-rose-800',
        warning: 'bg-amber-50 border-amber-500 text-amber-800',
        info: 'bg-indigo-50 border-indigo-500 text-indigo-800',
    };

    const iconColors = {
        success: 'text-emerald-500',
        error: 'text-rose-500',
        warning: 'text-amber-500',
        info: 'text-indigo-500',
    };

    return (
        <div
            className={`
        pointer-events-auto
        flex items-start gap-3
        p-4 rounded-lg border-l-4 shadow-lg
        ${colors[toast.type]}
        transform transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        animate-in slide-in-from-right
      `}
            role="alert"
        >
            <div className={`flex-shrink-0 ${iconColors[toast.type]}`}>
                {icons[toast.type]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{toast.title}</p>
                {toast.message && (
                    <p className="mt-1 text-sm opacity-90">{toast.message}</p>
                )}
                {toast.action && (
                    toast.action.onClick ? (
                        <button
                            onClick={() => {
                                toast.action?.onClick?.();
                                handleClose();
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                        >
                            {toast.action.label}
                        </button>
                    ) : toast.action.href ? (
                        <Link
                            href={toast.action.href}
                            className="inline-flex items-center gap-1 mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                            onClick={handleClose}
                        >
                            {toast.action.label}
                        </Link>
                    ) : null
                )}
            </div>
            <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
                aria-label="Dismiss"
            >
                <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
