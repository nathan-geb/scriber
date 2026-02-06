'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    children: ReactNode;
    showCloseButton?: boolean;
}

/**
 * Reusable Modal component with backdrop, focus trap, and escape key handling
 */
export function Modal({
    isOpen,
    onClose,
    title,
    size = 'md',
    children,
    showCloseButton = true,
}: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Focus trap
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[90vw] max-h-[90vh]',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-secondary/60 backdrop-blur-md animate-fade-in" />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
                tabIndex={-1}
                className={`
                    relative bg-surface rounded-[24px] shadow-2xl border border-border/50
                    w-full ${sizeClasses[size]} 
                    animate-scale-in
                    flex flex-col max-h-[90vh]
                    backdrop-blur-xl
                `}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                        {title && (
                            <h2 id="modal-title" className="text-lg font-semibold text-text-main truncate">
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                aria-label="Close modal"
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-muted hover:text-text-main transition-colors ml-auto"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
