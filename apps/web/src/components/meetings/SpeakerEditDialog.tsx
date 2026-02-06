'use client';

import React, { useState } from 'react';
import { X, Users, Edit2, Check, ArrowRight, CheckCircle2 } from 'lucide-react';
// import { useAuth } from '../../../lib/AuthContext'; // unused
// import { useConfig } from '../../../lib/ConfigContext'; // unused

interface Speaker {
    id: string;
    name: string;
    isUnknown?: boolean;
    nameConfidence?: number;
    isConfirmed?: boolean;
}

interface SpeakerEditDialogProps {
    speaker: Speaker;
    allSpeakers: Speaker[]; // For merge options
    isOpen: boolean;
    onClose: () => void;
    onRename: (id: string, newName: string) => Promise<void>;
    onMerge: (sourceId: string, targetId: string) => Promise<void>;
    onConfirm?: (id: string) => Promise<void>;
}

export function SpeakerEditDialog({
    speaker,
    allSpeakers,
    isOpen,
    onClose,
    onRename,
    onMerge,
    onConfirm,
}: SpeakerEditDialogProps) {
    const [name, setName] = useState(speaker.name);
    const [mode, setMode] = useState<'rename' | 'merge' | 'confirm'>('rename');
    const showConfirmOption = onConfirm && !speaker.isConfirmed;
    const [targetSpeakerId, setTargetSpeakerId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    // Filter out the current speaker from merge options
    const mergeOptions = allSpeakers.filter(s => s.id !== speaker.id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (mode === 'rename') {
                await onRename(speaker.id, name);
            } else if (mode === 'merge') {
                if (!targetSpeakerId) return;
                await onMerge(speaker.id, targetSpeakerId);
            } else if (mode === 'confirm' && onConfirm) {
                await onConfirm(speaker.id);
            }
            onClose();
        } catch (error) {
            console.error('Failed to update speaker:', error);
            // Ideally show toast error here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border bg-background-secondary">
                    <h3 className="font-semibold text-text-main">Edit Speaker</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex p-1 bg-surface-hover rounded-lg">
                        <button
                            type="button"
                            onClick={() => setMode('rename')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'rename'
                                ? 'bg-surface shadow-sm text-primary'
                                : 'text-text-muted hover:text-text-main'
                                }`}
                        >
                            <Edit2 size={16} />
                            Rename
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('merge')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'merge'
                                ? 'bg-surface shadow-sm text-primary'
                                : 'text-text-muted hover:text-text-main'
                                }`}
                        >
                            <Users size={16} />
                            Merge
                        </button>
                        {showConfirmOption && (
                            <button
                                type="button"
                                onClick={() => setMode('confirm')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'confirm'
                                    ? 'bg-surface shadow-sm text-green-600'
                                    : 'text-text-muted hover:text-text-main'
                                    }`}
                            >
                                <CheckCircle2 size={16} />
                                Confirm
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'rename' && (
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">
                                    Speaker Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main"
                                    placeholder="Enter name"
                                    autoFocus
                                />
                            </div>
                        )}

                        {mode === 'merge' && (
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">
                                    Merge &ldquo;{speaker.name}&rdquo; into:
                                </label>
                                <select
                                    value={targetSpeakerId}
                                    onChange={(e) => setTargetSpeakerId(e.target.value)}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main appearance-none"
                                    title="Target speaker"
                                >
                                    <option value="">Select a speaker...</option>
                                    {mergeOptions.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-2 text-xs text-amber-500 flex items-center gap-1">
                                    <ArrowRight size={12} />
                                    This will reassign all segments from {speaker.name} to the selected speaker.
                                </p>
                            </div>
                        )}

                        {mode === 'confirm' && (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 size={32} className="text-green-600" />
                                </div>
                                <p className="text-sm text-text-main font-medium mb-2">
                                    Confirm this speaker identity?
                                </p>
                                <p className="text-xs text-text-muted">
                                    This verifies &ldquo;{speaker.name}&rdquo; is correct and removes the uncertainty indicator.
                                </p>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || (mode === 'merge' && !targetSpeakerId)}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check size={16} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
