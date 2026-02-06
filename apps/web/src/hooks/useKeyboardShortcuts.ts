'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutHandlers {
    onPlayPause?: () => void;
    onSkipForward?: (seconds?: number) => void;
    onSkipBackward?: (seconds?: number) => void;
    onNextSegment?: () => void;
    onPrevSegment?: () => void;
    onShowHelp?: () => void;
}

const DEFAULT_SKIP_SECONDS = 5;
const LONG_SKIP_SECONDS = 15;

export function useKeyboardShortcuts(
    handlers: KeyboardShortcutHandlers,
    enabled: boolean = true
) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            return;
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                handlers.onPlayPause?.();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    handlers.onSkipBackward?.(LONG_SKIP_SECONDS);
                } else {
                    handlers.onSkipBackward?.(DEFAULT_SKIP_SECONDS);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) {
                    handlers.onSkipForward?.(LONG_SKIP_SECONDS);
                } else {
                    handlers.onSkipForward?.(DEFAULT_SKIP_SECONDS);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                handlers.onPrevSegment?.();
                break;
            case 'ArrowDown':
                e.preventDefault();
                handlers.onNextSegment?.();
                break;
            case 'Slash':
                if (e.shiftKey) {
                    // ? key
                    e.preventDefault();
                    handlers.onShowHelp?.();
                }
                break;
        }
    }, [handlers]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, handleKeyDown]);
}

export const KEYBOARD_SHORTCUTS = [
    { key: 'Space', action: 'Play / Pause' },
    { key: '←', action: 'Rewind 5 seconds' },
    { key: '→', action: 'Forward 5 seconds' },
    { key: 'Shift + ←', action: 'Rewind 15 seconds' },
    { key: 'Shift + →', action: 'Forward 15 seconds' },
    { key: '↑', action: 'Previous segment' },
    { key: '↓', action: 'Next segment' },
    { key: '?', action: 'Show keyboard shortcuts' },
];
