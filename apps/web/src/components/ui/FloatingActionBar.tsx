import React from 'react';
import { X } from 'lucide-react';

interface FloatingActionBarProps {
    isOpen: boolean;
    selectedCount: number;
    onClear: () => void;
    children: React.ReactNode;
}

export function FloatingActionBar({
    isOpen,
    selectedCount,
    onClear,
    children
}: FloatingActionBarProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-center gap-4 bg-surface-overlay border border-border/50 shadow-2xl rounded-full px-6 py-3 backdrop-blur-md">
                <div className="flex items-center gap-3 border-r border-border/50 pr-4">
                    <span className="font-semibold text-text-main whitespace-nowrap">
                        {selectedCount} selected
                    </span>
                    <button
                        onClick={onClear}
                        className="p-1 hover:bg-surface-highlight rounded-full text-text-muted hover:text-text-main transition-colors"
                        title="Clear selection"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {children}
                </div>
            </div>
        </div>
    );
}
