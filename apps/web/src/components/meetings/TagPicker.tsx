'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react';

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface MeetingTag {
    tagId: string;
    tag: TagData;
}

interface TagPickerProps {
    meetingId: string;
    meetingTags: MeetingTag[];
    onTagsUpdated: () => void;
}

export function TagPicker({ meetingId, meetingTags, onTagsUpdated }: TagPickerProps) {
    const { token } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [availableTags, setAvailableTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [creating, setCreating] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get IDs of currently assigned tags
    const assignedTagIds = new Set(meetingTags.map(mt => mt.tagId));

    // Fetch all available tags
    useEffect(() => {
        const fetchTags = async () => {
            if (!token) return;
            try {
                const res = await fetch(apiEndpoint('/tags'), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAvailableTags(data);
                }
            } catch (err) {
                console.error('Failed to fetch tags', err);
            }
        };
        if (isOpen) {
            fetchTags();
        }
    }, [token, isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddTag = async (tagId: string) => {
        setLoading(true);
        try {
            const res = await fetch(apiEndpoint(`/meetings/${meetingId}/tags/${tagId}`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                onTagsUpdated();
            }
        } catch (err) {
            console.error('Failed to add tag', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        setLoading(true);
        try {
            const res = await fetch(apiEndpoint(`/meetings/${meetingId}/tags/${tagId}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                onTagsUpdated();
            }
        } catch (err) {
            console.error('Failed to remove tag', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(apiEndpoint('/tags'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: newTagName.trim(), color: selectedColor })
            });
            if (res.ok) {
                const newTag = await res.json();
                setAvailableTags(prev => [...prev, newTag]);
                setNewTagName('');
                // Auto-add the new tag to meeting
                await handleAddTag(newTag.id);
            }
        } catch (err) {
            console.error('Failed to create tag', err);
        } finally {
            setCreating(false);
        }
    };

    // Color helper
    const getTagStyle = (color: string) => {
        const colors: Record<string, string> = {
            blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
            indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        };
        return colors[color] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    };

    const colorOptions = ['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo'];
    const [selectedColor, setSelectedColor] = useState('blue');

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Current Tags + Add Button */}
            <div className="flex flex-wrap items-center gap-2">
                {meetingTags.map((mt) => (
                    <span
                        key={mt.tagId}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTagStyle(mt.tag.color)}`}
                    >
                        {mt.tag.name}
                        <button
                            onClick={() => handleRemoveTag(mt.tagId)}
                            className="hover:opacity-70 transition-opacity"
                            disabled={loading}
                            title={`Remove ${mt.tag.name} tag`}
                            aria-label={`Remove ${mt.tag.name} tag`}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-text-muted hover:text-text-main transition-colors border border-dashed border-border"
                    title="Add Tag"
                    aria-label="Add Tag"
                >
                    <Plus size={12} />
                    Add Tag
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-border space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                                placeholder="Create new tag..."
                                className="flex-1 px-2 py-1 text-sm bg-transparent border-none focus:outline-none text-text-main placeholder:text-text-muted"
                            />
                            {newTagName.trim() && (
                                <button
                                    onClick={handleCreateTag}
                                    disabled={creating}
                                    className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                                >
                                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                </button>
                            )}
                        </div>
                        {/* Color Picker */}
                        {newTagName.trim() && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                {colorOptions.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setSelectedColor(color)}
                                        className={`w-4 h-4 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-110'} bg-${color}-500`}
                                        title={color}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                        {availableTags.length === 0 ? (
                            <p className="p-3 text-sm text-text-muted text-center">No tags yet</p>
                        ) : (
                            availableTags.map((tag) => {
                                const isAssigned = assignedTagIds.has(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => isAssigned ? handleRemoveTag(tag.id) : handleAddTag(tag.id)}
                                        disabled={loading}
                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors"
                                    >
                                        <span className={`inline-flex items-center gap-2 text-sm ${getTagStyle(tag.color)} px-2 py-0.5 rounded-full`}>
                                            <Tag size={12} />
                                            {tag.name}
                                        </span>
                                        {isAssigned && <Check size={14} className="text-primary" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
