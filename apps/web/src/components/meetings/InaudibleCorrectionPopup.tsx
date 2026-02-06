'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface InaudibleCorrectionPopupProps {
    segmentId: string;
    originalText: string;
    position: { x: number; y: number };
    onClose: () => void;
    onSave: (correctedText: string) => void;
}

export function InaudibleCorrectionPopup({
    segmentId,
    originalText,
    position,
    onClose,
    onSave,
}: InaudibleCorrectionPopupProps) {
    const { token } = useAuth();
    const [correction, setCorrection] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!correction.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corrections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    segmentId,
                    originalText,
                    correctedText: correction.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save correction');
            }

            onSave(correction.trim());
            onClose();
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            ref={popupRef}
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-border p-3 min-w-[280px]"
            style={{
                left: Math.min(position.x, window.innerWidth - 300),
                top: position.y + 10,
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-main">
                    Fix unclear audio
                </span>
                <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-main transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="mb-3 text-xs text-text-muted bg-red-50 px-2 py-1 rounded">
                Original: <span className="font-mono text-red-600">{originalText}</span>
            </div>

            <form onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="Type what was actually said..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    disabled={loading}
                />

                {error && (
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                )}

                <div className="flex justify-end gap-2 mt-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm text-text-muted hover:text-text-main transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!correction.trim() || loading}
                        className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={14} />
                                Save
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
