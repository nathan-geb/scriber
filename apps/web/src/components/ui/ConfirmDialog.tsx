'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Modal confirmation dialog for destructive actions
 */
export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, onCancel]);

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

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: (
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                    ),
                    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
                };
            case 'warning':
                return {
                    icon: (
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    ),
                    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
                };
            default:
                return {
                    icon: null,
                    buttonClass: 'bg-primary hover:bg-primary-hover text-white',
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isLoading) {
                    onCancel();
                }
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-description"
                tabIndex={-1}
                className="relative bg-surface rounded-2xl shadow-xl border border-border max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
            >
                {styles.icon}

                <h2 id="dialog-title" className="text-xl font-bold text-text-main text-center">
                    {title}
                </h2>

                <p id="dialog-description" className="mt-2 text-text-muted text-center">
                    {message}
                </p>

                <div className="mt-6 flex gap-3 justify-center">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        className={styles.buttonClass}
                        onClick={onConfirm}
                        isLoading={isLoading}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
