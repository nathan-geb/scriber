'use client';

import React, { useState } from 'react';
import { Users, ArrowRight, Check, X, GripVertical, AlertCircle } from 'lucide-react';

interface Speaker {
    id: string;
    name: string;
    isUnknown?: boolean;
    _count?: { segments: number };
}

interface SpeakerMergeCardProps {
    speakers: Speaker[];
    onMerge: (sourceId: string, targetId: string) => Promise<void>;
    onClose: () => void;
}

export function SpeakerMergeCard({
    speakers,
    onMerge,
    onClose,
}: SpeakerMergeCardProps) {
    const [draggedSpeaker, setDraggedSpeaker] = useState<Speaker | null>(null);
    const [dropTarget, setDropTarget] = useState<Speaker | null>(null);
    const [mergePreview, setMergePreview] = useState<{
        source: Speaker;
        target: Speaker;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleDragStart = (e: React.DragEvent, speaker: Speaker) => {
        setDraggedSpeaker(speaker);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, speaker: Speaker) => {
        e.preventDefault();
        if (draggedSpeaker && draggedSpeaker.id !== speaker.id) {
            setDropTarget(speaker);
        }
    };

    const handleDragLeave = () => {
        setDropTarget(null);
    };

    const handleDrop = (e: React.DragEvent, targetSpeaker: Speaker) => {
        e.preventDefault();
        if (draggedSpeaker && draggedSpeaker.id !== targetSpeaker.id) {
            setMergePreview({
                source: draggedSpeaker,
                target: targetSpeaker,
            });
        }
        setDraggedSpeaker(null);
        setDropTarget(null);
    };

    const handleDragEnd = () => {
        setDraggedSpeaker(null);
        setDropTarget(null);
    };

    const handleConfirmMerge = async () => {
        if (!mergePreview) return;

        setIsLoading(true);
        try {
            await onMerge(mergePreview.source.id, mergePreview.target.id);
            setMergePreview(null);
        } catch (error) {
            console.error('Failed to merge:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelMerge = () => {
        setMergePreview(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border bg-background-secondary">
                    <div className="flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        <h3 className="font-semibold text-text-main">Merge Speakers</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <p className="text-sm text-text-muted mb-4">
                        Drag one speaker onto another to merge them. All segments will be reassigned to the target speaker.
                    </p>

                    {/* Merge Preview */}
                    {mergePreview && (
                        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <AlertCircle size={20} className="text-amber-600" />
                                <span className="font-medium text-amber-800">Confirm Merge</span>
                            </div>
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <div className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-medium">
                                    {mergePreview.source.name}
                                    <span className="text-xs text-text-muted ml-1">
                                        ({mergePreview.source._count?.segments || 0} segments)
                                    </span>
                                </div>
                                <ArrowRight size={20} className="text-amber-600" />
                                <div className="px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg text-sm font-medium">
                                    {mergePreview.target.name}
                                    <span className="text-xs text-text-muted ml-1">
                                        ({mergePreview.target._count?.segments || 0} segments)
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">
                                &ldquo;{mergePreview.source.name}&rdquo; will be deleted and all their segments will be assigned to &ldquo;{mergePreview.target.name}&rdquo;.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={handleCancelMerge}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-main transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmMerge}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Check size={16} />
                                    )}
                                    Confirm Merge
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Speaker List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {speakers.map(speaker => (
                            <div
                                key={speaker.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, speaker)}
                                onDragOver={(e) => handleDragOver(e, speaker)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, speaker)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                                    ${dropTarget?.id === speaker.id
                                        ? 'border-primary bg-primary/10 scale-[1.02]'
                                        : 'border-border bg-surface hover:bg-surface-hover'
                                    }
                                    ${draggedSpeaker?.id === speaker.id ? 'opacity-50' : ''}
                                `}
                            >
                                <GripVertical size={16} className="text-text-muted flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-text-main truncate">
                                        {speaker.name}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        {speaker._count?.segments || 0} segments
                                        {speaker.isUnknown && (
                                            <span className="ml-2 text-amber-600">(Unknown)</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {speakers.length < 2 && (
                        <p className="text-sm text-text-muted text-center py-4">
                            Need at least 2 speakers to merge.
                        </p>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-background-secondary flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
