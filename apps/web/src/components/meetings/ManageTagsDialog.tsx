'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { Trash2, Edit2, X, Save, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface ManageTagsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onTagsUpdated: () => void;
}

export function ManageTagsDialog({ isOpen, onClose, onTagsUpdated }: ManageTagsDialogProps) {
    const { token } = useAuth();
    const [tags, setTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const colorOptions = ['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo'];



    const fetchTags = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(apiEndpoint('/tags'), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTags(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (isOpen && token) {
            void fetchTags();
        }
    }, [isOpen, token, fetchTags]);

    useEffect(() => {
        if (isOpen && token) {
            void fetchTags();
        }
    }, [isOpen, token, fetchTags]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tag? It will be removed from all meetings.')) return;
        try {
            await fetch(apiEndpoint(`/tags/${id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            setTags(prev => prev.filter(t => t.id !== id));
            onTagsUpdated();
        } catch (err) {
            console.error(err);
        }
    };

    const startEdit = (tag: TagData) => {
        setEditingId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        try {
            const res = await fetch(apiEndpoint(`/tags/${editingId}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: editName.trim(), color: editColor })
            });

            if (res.ok) {
                const updated = await res.json();
                setTags(prev => prev.map(t => t.id === editingId ? updated : t));
                setEditingId(null);
                onTagsUpdated();
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-border bg-background-secondary/50">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Tag size={18} /> Manage Tags
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                    {loading && tags.length === 0 ? (
                        <div className="text-center py-8 text-text-muted">Loading tags...</div>
                    ) : tags.length === 0 ? (
                        <div className="text-center py-8 text-text-muted">No tags found.</div>
                    ) : (
                        tags.map(tag => (
                            <div key={tag.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border group hover:border-primary/30 transition-colors">
                                {editingId === tag.id ? (
                                    <div className="flex-1 flex flex-col gap-2">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full px-2 py-1 bg-background text-sm rounded border border-border focus:border-primary outline-none"
                                            autoFocus
                                            placeholder="Tag name"
                                            aria-label="Edit tag name"
                                        />
                                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                            {colorOptions.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setEditColor(color)}
                                                    className={`w-4 h-4 rounded-full transition-all ${editColor === color ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface scale-110' : 'hover:scale-110'} bg-${color}-500`}
                                                    title={`Select ${color}`}
                                                    aria-label={`Select ${color} color`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`w-3 h-3 rounded-full bg-${tag.color}-500 shrink-0`} />
                                        <span className="flex-1 font-medium text-sm">{tag.name}</span>
                                    </>
                                )}

                                <div className="flex items-center gap-1">
                                    {editingId === tag.id ? (
                                        <button
                                            onClick={saveEdit}
                                            className="p-1.5 text-green-500 hover:bg-green-500/10 rounded"
                                            title="Save"
                                            aria-label="Save tag changes"
                                        >
                                            <Save size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => startEdit(tag)}
                                            className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="Edit"
                                            aria-label={`Edit ${tag.name}`}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(tag.id)}
                                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete"
                                        aria-label={`Delete ${tag.name}`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border bg-background-secondary/30 flex justify-end">
                    <Button onClick={onClose} variant="secondary">Done</Button>
                </div>
            </div>
        </div>
    );
}
