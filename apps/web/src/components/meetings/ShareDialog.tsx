'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { Button } from '@/components/ui/Button';
import { Share2, Copy, Check, Link2, Trash2, Loader2, X } from 'lucide-react';

interface ShareLink {
    id: string;
    token: string;
    shareType: 'FULL' | 'MINUTES' | 'TRANSCRIPT';
    expiresAt: string | null;
    createdAt: string;
    shareUrl?: string;
}

interface ShareDialogProps {
    meetingId: string;
    meetingTitle: string;
    isOpen: boolean;
    onClose: () => void;
}

export function ShareDialog({ meetingId, meetingTitle, isOpen, onClose }: ShareDialogProps) {
    const { token } = useAuth();
    const [shareType, setShareType] = useState<'FULL' | 'MINUTES' | 'TRANSCRIPT'>('FULL');
    const [expiresIn, setExpiresIn] = useState<number | null>(null);
    const [existingLinks, setExistingLinks] = useState<ShareLink[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch existing share links
    const fetchExistingLinks = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(apiEndpoint(`/shares/meeting/${meetingId}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setExistingLinks(data);
            }
        } catch {
            console.error('Failed to fetch share links');
        } finally {
            setIsLoading(false);
        }
    }, [token, meetingId]);

    useEffect(() => {
        if (isOpen) {
            fetchExistingLinks();
        }
    }, [isOpen, fetchExistingLinks]);

    const handleCreateLink = async () => {
        setIsCreating(true);
        setError(null);

        try {
            const res = await fetch(apiEndpoint('/shares'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    meetingId,
                    shareType,
                    expiresInHours: expiresIn,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to create share link');
            }

            const newLink = await res.json();
            setExistingLinks((prev) => [newLink, ...prev]);
        } catch {
            setError('Failed to create share link. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRevokeLink = async (linkId: string) => {
        try {
            const res = await fetch(apiEndpoint(`/shares/${linkId}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                setExistingLinks((prev) => prev.filter((l) => l.id !== linkId));
            }
        } catch {
            console.error('Failed to revoke link');
        }
    };

    const handleCopyLink = async (link: ShareLink) => {
        const url = link.shareUrl || `${window.location.origin}/share/${link.token}`;
        await navigator.clipboard.writeText(url);
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const shareTypeLabels: Record<string, string> = {
        FULL: 'Full (Minutes + Transcript)',
        MINUTES: 'Minutes Only',
        TRANSCRIPT: 'Transcript Only',
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background-secondary">
                    <h3 className="font-semibold text-text-main flex items-center gap-2">
                        <Share2 size={18} />
                        Share Meeting
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <p className="text-sm text-text-muted">
                        Create a shareable link for &ldquo;{meetingTitle}&rdquo;
                    </p>

                    {/* Create new link */}
                    <div className="space-y-3 p-4 bg-surface-hover rounded-lg">
                        <h4 className="text-sm font-medium text-text-main">Create New Link</h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Share Type</label>
                                <select
                                    value={shareType}
                                    onChange={(e) => setShareType(e.target.value as typeof shareType)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-main"
                                    title="Share type"
                                >
                                    <option value="FULL">Full</option>
                                    <option value="MINUTES">Minutes Only</option>
                                    <option value="TRANSCRIPT">Transcript Only</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Expires</label>
                                <select
                                    value={expiresIn ?? ''}
                                    onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-main"
                                    title="Expiration time"
                                >
                                    <option value="">Never</option>
                                    <option value="24">24 hours</option>
                                    <option value="168">7 days</option>
                                    <option value="720">30 days</option>
                                </select>
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateLink}
                            disabled={isCreating}
                            className="w-full"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Create Link
                                </>
                            )}
                        </Button>

                        {error && <p className="text-xs text-red-500">{error}</p>}
                    </div>

                    {/* Existing links */}
                    <div>
                        <h4 className="text-sm font-medium text-text-main mb-2">Active Links</h4>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                            </div>
                        ) : existingLinks.length === 0 ? (
                            <p className="text-sm text-text-muted py-4 text-center">
                                No active share links
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {existingLinks.map((link) => (
                                    <div
                                        key={link.id}
                                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                                    {shareTypeLabels[link.shareType]}
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-muted mt-1 truncate">
                                                {link.expiresAt
                                                    ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                                                    : 'No expiration'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 ml-2">
                                            <button
                                                onClick={() => handleCopyLink(link)}
                                                className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                                                title="Copy link"
                                            >
                                                {copiedId === link.id ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <Copy className="h-4 w-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleRevokeLink(link.id)}
                                                className="p-2 text-text-muted hover:text-red-500 hover:bg-surface-hover rounded transition-colors"
                                                title="Revoke link"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
