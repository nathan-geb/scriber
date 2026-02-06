'use client';

import React, { useState } from 'react';
import {
    Bookmark,
    Plus,
    Trash2,
    Clock,
    CheckCircle2,
    HelpCircle,
    Lightbulb,
    AlertTriangle,
    Sparkles,
    X
} from 'lucide-react';

type MomentType = 'DECISION' | 'ACTION_ITEM' | 'QUESTION' | 'KEY_POINT' | 'DISAGREEMENT' | 'CUSTOM';

interface KeyMoment {
    id: string;
    timestamp: number;
    label: string;
    description?: string;
    type: MomentType;
    isAutomatic: boolean;
}

interface KeyMomentsSidebarProps {
    moments: KeyMoment[];
    onMomentClick: (timestamp: number) => void;
    onAddMoment: (timestamp: number, label: string, type: MomentType) => Promise<void>;
    onDeleteMoment: (id: string) => Promise<void>;
    onAutoDetect?: () => Promise<void>;
    currentTime: number;
}

const MOMENT_ICONS: Record<MomentType, React.ReactNode> = {
    DECISION: <CheckCircle2 size={14} className="text-green-500" />,
    ACTION_ITEM: <Clock size={14} className="text-blue-500" />,
    QUESTION: <HelpCircle size={14} className="text-purple-500" />,
    KEY_POINT: <Lightbulb size={14} className="text-yellow-500" />,
    DISAGREEMENT: <AlertTriangle size={14} className="text-orange-500" />,
    CUSTOM: <Bookmark size={14} className="text-gray-500" />,
};

const MOMENT_COLORS: Record<MomentType, string> = {
    DECISION: 'bg-green-50 border-green-200 hover:bg-green-100',
    ACTION_ITEM: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    QUESTION: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    KEY_POINT: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    DISAGREEMENT: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    CUSTOM: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
};

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function KeyMomentsSidebar({
    moments,
    onMomentClick,
    onAddMoment,
    onDeleteMoment,
    onAutoDetect,
    currentTime,
}: KeyMomentsSidebarProps) {
    const [isAddingMoment, setIsAddingMoment] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<MomentType>('CUSTOM');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddMoment = async () => {
        if (!newLabel.trim()) return;

        setIsLoading(true);
        try {
            await onAddMoment(currentTime, newLabel.trim(), newType);
            setNewLabel('');
            setNewType('CUSTOM');
            setIsAddingMoment(false);
        } catch (error) {
            console.error('Failed to add moment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoDetect = async () => {
        if (!onAutoDetect) return;

        setIsLoading(true);
        try {
            await onAutoDetect();
        } catch (error) {
            console.error('Failed to auto-detect:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setIsLoading(true);
        try {
            await onDeleteMoment(id);
        } catch (error) {
            console.error('Failed to delete:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-3 border-b border-border bg-background-secondary flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bookmark size={16} className="text-primary" />
                    <span className="font-semibold text-sm text-text-main">Key Moments</span>
                    <span className="text-xs text-text-muted">({moments.length})</span>
                </div>
                <div className="flex items-center gap-1">
                    {onAutoDetect && (
                        <button
                            onClick={handleAutoDetect}
                            disabled={isLoading}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
                            title="Auto-detect key moments"
                        >
                            <Sparkles size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsAddingMoment(true)}
                        className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
                        title="Add key moment"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Add Moment Form */}
            {isAddingMoment && (
                <div className="p-3 border-b border-border bg-primary/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text-muted">
                            Add moment at {formatTime(currentTime)}
                        </span>
                        <button
                            onClick={() => setIsAddingMoment(false)}
                            className="p-1 text-text-muted hover:text-text-main"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="What happened here?"
                        className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary mb-2"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMoment()}
                    />
                    <div className="flex items-center gap-2">
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as MomentType)}
                            className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="CUSTOM">Custom</option>
                            <option value="DECISION">Decision</option>
                            <option value="ACTION_ITEM">Action Item</option>
                            <option value="QUESTION">Question</option>
                            <option value="KEY_POINT">Key Point</option>
                            <option value="DISAGREEMENT">Discussion</option>
                        </select>
                        <button
                            onClick={handleAddMoment}
                            disabled={!newLabel.trim() || isLoading}
                            className="px-3 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}

            {/* Moments List */}
            <div className="max-h-80 overflow-y-auto">
                {moments.length === 0 ? (
                    <div className="p-4 text-center text-text-muted">
                        <Bookmark size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No key moments yet</p>
                        <p className="text-xs mt-1">Add moments manually or use auto-detect</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {moments.map((moment) => (
                            <div
                                key={moment.id}
                                className={`group flex items-start gap-2 p-2 cursor-pointer transition-colors ${MOMENT_COLORS[moment.type]}`}
                                onClick={() => onMomentClick(moment.timestamp)}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {MOMENT_ICONS[moment.type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-text-muted">
                                            {formatTime(moment.timestamp)}
                                        </span>
                                        {moment.isAutomatic && (
                                            <Sparkles size={10} className="text-primary" />
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-text-main truncate">
                                        {moment.label}
                                    </p>
                                    {moment.description && (
                                        <p className="text-xs text-text-muted truncate">
                                            {moment.description}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(moment.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all"
                                    title="Delete moment"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
