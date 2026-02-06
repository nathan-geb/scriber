'use client';

import { X, Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
                <div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <Keyboard size={20} className="text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold text-text-main">Keyboard Shortcuts</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="space-y-3">
                            {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between py-2"
                                >
                                    <span className="text-text-secondary">{shortcut.action}</span>
                                    <kbd className="px-3 py-1.5 bg-background border border-border rounded-lg font-mono text-sm text-text-main shadow-sm">
                                        {shortcut.key}
                                    </kbd>
                                </div>
                            ))}
                        </div>

                        <p className="mt-6 text-xs text-text-muted text-center">
                            Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">?</kbd> anytime to show this help
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
