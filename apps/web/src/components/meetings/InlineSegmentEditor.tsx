'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X, History, RotateCcw } from 'lucide-react';

interface SegmentEdit {
    id: string;
    previousText: string;
    newText: string;
    editedBy: string;
    editReason?: string;
    createdAt: string;
}

interface InlineSegmentEditorProps {
    segmentId: string;
    text: string;
    originalText?: string;
    onSave: (newText: string, reason?: string) => Promise<void>;
    onViewHistory?: () => void;
    editHistory?: SegmentEdit[];
    onRevert?: (editId: string) => Promise<void>;
    onReset?: () => Promise<void>;
}

export function InlineSegmentEditor({
    // segmentId,
    text,
    originalText,
    onSave,
    onViewHistory,
    editHistory,
    onRevert,
    onReset,
}: InlineSegmentEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);
    const [isLoading, setIsLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        setEditedText(text);
    }, [text]);

    const handleSave = async () => {
        if (editedText.trim() === text) {
            setIsEditing(false);
            return;
        }

        setIsLoading(true);
        try {
            await onSave(editedText.trim());
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setEditedText(text);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const handleRevert = async (editId: string) => {
        if (!onRevert) return;

        setIsLoading(true);
        try {
            await onRevert(editId);
            setShowHistory(false);
        } catch (error) {
            console.error('Failed to revert:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isEditing) {
        return (
            <div className="group relative">
                <span className="cursor-text">{text}</span>
                <button
                    onClick={() => setIsEditing(true)}
                    className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-primary transition-all"
                    title="Edit segment"
                >
                    <Edit3 size={12} />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-background border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main resize-none"
                    placeholder="Enter segment text..."
                />
                <div className="absolute bottom-2 right-2 text-xs text-text-light">
                    ⌘+Enter to save, Esc to cancel
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    {onViewHistory && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-main transition-colors"
                        >
                            <History size={12} />
                            History
                        </button>
                    )}
                    {onReset && originalText && text !== originalText && (
                        <button
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    await onReset();
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                            title="Reset to original transcription"
                        >
                            <RotateCcw size={12} />
                            Reset
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-main transition-colors"
                    >
                        <X size={12} />
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Check size={12} />
                        )}
                        Save
                    </button>
                </div>
            </div>

            {/* Edit History Panel */}
            {showHistory && editHistory && editHistory.length > 0 && (
                <div className="mt-2 p-3 bg-surface-hover border border-border rounded-lg">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Edit History</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {editHistory.map((edit) => (
                            <div key={edit.id} className="flex items-start gap-2 p-2 bg-background rounded-lg text-xs">
                                <div className="flex-1 min-w-0">
                                    <div className="text-text-muted mb-1">
                                        {new Date(edit.createdAt).toLocaleString()}
                                    </div>
                                    <div className="text-text-main line-through opacity-60 truncate">
                                        {edit.previousText}
                                    </div>
                                    {edit.editReason && (
                                        <div className="text-text-muted mt-1 italic">
                                            Reason: {edit.editReason}
                                        </div>
                                    )}
                                </div>
                                {onRevert && (
                                    <button
                                        onClick={() => handleRevert(edit.id)}
                                        disabled={isLoading}
                                        className="flex-shrink-0 p-1 text-text-muted hover:text-primary transition-colors"
                                        title="Revert to this version"
                                    >
                                        <RotateCcw size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
