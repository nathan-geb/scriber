'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PipelineProgress } from '@/components/meetings/PipelineProgress';
import { ManageTagsDialog } from '@/components/meetings/ManageTagsDialog';
import { TagList } from '@/components/ui/TagChip';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Navbar } from '@/components/layout/Navbar';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';
import type { Meeting } from '@echomint/core';
import {
    RefreshCw,
    FileAudio,
    Loader2,
    Calendar,
    Clock,
    Mic,
    Trash2,
    Search,
    Upload,
    AlertCircle,
    X
} from 'lucide-react';


interface PaginatedResponse {
    items: Meeting[];
    nextCursor?: string;
    hasMore: boolean;
}

export default function MeetingsPage() {
    const { token, user } = useAuth();
    const toast = useToast();
    const router = useRouter();
    const { socket } = useSocket();

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchDeleting, setBatchDeleting] = useState(false);
    const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

    // Pagination state
    const [cursor, setCursor] = useState<string | undefined>();
    const [hasMore, setHasMore] = useState(false);
    const cursorRef = useRef<string | undefined>(undefined);

    // Keep cursorRef in sync with cursor state
    useEffect(() => {
        cursorRef.current = cursor;
    }, [cursor]);

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    // Filter state
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [dateFilter, setDateFilter] = useState<string>('ALL_TIME');
    const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
    const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([]);

    // Single delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Tag management state
    const [showManageTags, setShowManageTags] = useState(false);

    // Recently completed meetings for celebration animation
    const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set());

    // Fetch available tags for filter
    const fetchTags = useCallback(async () => {
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
    }, [token]);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    // Fetch meetings function - only for initial load and filter changes
    const fetchMeetings = useCallback(async (reset = true) => {
        if (!token) return;

        if (reset) {
            setLoading(true);
            setCursor(undefined);
            cursorRef.current = undefined;
        } else {
            setLoadingMore(true);
        }

        try {
            const params = new URLSearchParams();
            // Use cursorRef for non-reset fetches to avoid dependency on cursor state
            if (!reset && cursorRef.current) params.set('cursor', cursorRef.current);
            if (searchQuery) params.set('search', searchQuery);
            if (selectedTagId) params.set('tagId', selectedTagId);

            if (statusFilter !== 'ALL') params.set('status', statusFilter);

            if (dateFilter !== 'ALL_TIME') {
                const now = new Date();
                const end = new Date(now); // now
                const start = new Date(now);

                if (dateFilter === 'LAST_7_DAYS') {
                    start.setDate(now.getDate() - 7);
                } else if (dateFilter === 'LAST_30_DAYS') {
                    start.setDate(now.getDate() - 30);
                }

                params.set('startDate', start.toISOString());
                params.set('endDate', end.toISOString());
            }

            params.set('limit', '20');

            const res = await fetch(
                `${apiEndpoint(API_ENDPOINTS.MEETINGS)}?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.ok) {
                const data: PaginatedResponse = await res.json();
                // Deduplicate items by ID using a Map to ensure uniqueness
                const deduplicateById = (items: Meeting[]) => {
                    const map = new Map<string, Meeting>();
                    items.forEach(item => map.set(item.id, item));
                    return Array.from(map.values());
                };

                if (reset) {
                    setMeetings(deduplicateById(data.items));
                } else {
                    setMeetings(prev => deduplicateById([...prev, ...data.items]));
                }
                setCursor(data.nextCursor);
                setHasMore(data.hasMore);
            }
        } catch (err) {
            console.error('Failed to fetch meetings', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [token, searchQuery, selectedTagId, statusFilter, dateFilter]);

    // Update a specific meeting's status in state (for real-time updates)
    const updateMeetingStatus = useCallback((meetingId: string, newStatus: Meeting['status']) => {
        setMeetings(prev => prev.map(meeting =>
            meeting.id === meetingId
                ? { ...meeting, status: newStatus }
                : meeting
        ));
    }, []);

    // Fetch meetings on mount and when filters change
    // Fetch meetings on mount and when filters change
    useEffect(() => {
        fetchMeetings(true);
    }, [fetchMeetings]);

    // Listen for new meetings created in real-time
    useEffect(() => {
        if (!socket) return;

        const handleMeetingCreated = (data: {
            id: string;
            title: string;
            status: string;
            createdAt: string;
            durationSeconds?: number | null;
            originalFileName?: string | null;
        }) => {
            // Add the new meeting to the top of the list
            // Note: userId and updatedAt are required by Meeting type but not used for display
            const newMeeting = {
                id: data.id,
                title: data.title,
                status: data.status as Meeting['status'],
                createdAt: data.createdAt,
                updatedAt: data.createdAt, // Use createdAt as placeholder
                userId: '', // Not needed for display
                durationSeconds: data.durationSeconds ?? undefined,
                originalFileName: data.originalFileName ?? undefined,
            } as Meeting;

            setMeetings(prev => {
                // Don't add if already exists
                if (prev.some(m => m.id === data.id)) return prev;
                return [newMeeting, ...prev];
            });
        };

        socket.on('meeting:created', handleMeetingCreated);

        return () => {
            socket.off('meeting:created', handleMeetingCreated);
        };
    }, [socket]);

    const handleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    // const handleSelectAll = ... (removed unused)

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0 || !token) return;

        setBatchDeleting(true);
        try {
            const res = await fetch(`${apiEndpoint(API_ENDPOINTS.MEETINGS)}/batch-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });

            if (!res.ok) throw new Error('Failed to delete meetings');

            const count = (await res.json()).count;

            setMeetings(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
            toast.success('Deleted', `${count} meetings have been deleted`);
            setShowBatchDeleteConfirm(false);
        } catch (err) {
            toast.error('Error', 'Could not delete meetings');
            console.error(err);
        } finally {
            setBatchDeleting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        setDeleting(true);
        try {
            const res = await fetch(`${apiEndpoint(API_ENDPOINTS.MEETINGS)}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setMeetings(prev => prev.filter(m => m.id !== id));
                toast.success('Deleted', 'Meeting has been deleted');
                setDeleteId(null);
            }
        } catch (err) {
            toast.error('Error', 'Could not delete meeting');
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiEndpoint(API_ENDPOINTS.MEETINGS)}/${id}/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                // Update meeting status locally
                setMeetings(prev => prev.map(m =>
                    m.id === id ? { ...m, status: 'CANCELLED' as const } : m
                ));
                toast.success('Cancelled', 'Processing has been cancelled. You can retry later.');
            } else {
                const error = await res.json();
                toast.error('Error', error.message || 'Could not cancel processing');
            }
        } catch (err) {
            toast.error('Error', 'Could not cancel processing');
            console.error(err);
        }
    };

    // Load more handler
    const handleLoadMore = useCallback(() => {
        if (hasMore && !loadingMore) {
            fetchMeetings(false);
        }
    }, [hasMore, loadingMore, fetchMeetings]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '00:00';
        // Subtract 1 to match audio player (DB stores Math.ceil, player reads actual)
        const adjusted = Math.max(0, seconds - 1);
        const mins = Math.floor(adjusted / 60);
        const secs = Math.floor(adjusted % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };



    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-900 pb-32 relative selection:bg-violet-200 overflow-x-hidden">
            {/* Header Background - Shorter gradient ending at first card */}
            <div className="absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] z-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Header Content */}
            <header className="px-6 md:px-12 pt-14 pb-8 flex flex-col gap-6 relative z-20 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-violet-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5">Library</p>
                        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">My Meetings.</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Navbar />
                        {/* Mobile Action Button (if needed) */}
                        <Link href="/record" className="md:hidden w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                            <Mic size={20} />
                        </Link>
                        {/* Desktop User Avatar */}
                        <Link href="/settings" className="hidden md:flex w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl items-center justify-center border border-white/10 hover:bg-white/20 transition-colors group" aria-label="Settings">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-500 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                                {user?.name?.[0] || 'U'}
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Filters Bar - Floating Glass */}
                <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search meetings..."
                            className="pl-10 bg-slate-50 border-transparent focus:bg-white focus:border-violet-500 transition-all rounded-xl"
                        />
                    </div>

                    <div className="flex w-full md:w-auto overflow-x-auto gap-2 no-scrollbar pb-1 md:pb-0">
                        {/* Filter Selects */}
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            aria-label="Filter by Date"
                            className="px-4 py-2.5 text-sm bg-slate-50 border-none rounded-xl text-slate-600 font-medium focus:ring-2 focus:ring-violet-500/20 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="ALL_TIME">All Time</option>
                            <option value="LAST_7_DAYS">Last 7 Days</option>
                            <option value="LAST_30_DAYS">Last 30 Days</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filter by Status"
                            className="px-4 py-2.5 text-sm bg-slate-50 border-none rounded-xl text-slate-600 font-medium focus:ring-2 focus:ring-violet-500/20 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <option value="ALL">All Status</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="FAILED">Failed</option>
                            <option value="PROCESSING">Processing</option>
                        </select>

                        <select
                            value={selectedTagId || ''}
                            onChange={(e) => setSelectedTagId(e.target.value || null)}
                            aria-label="Filter by Tag"
                            className="px-4 py-2.5 text-sm bg-slate-50 border-none rounded-xl text-slate-600 font-medium focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-100 transition-colors min-w-[120px]"
                        >
                            <option value="">All Tags</option>
                            {availableTags.map((tag) => (
                                <option key={tag.id} value={tag.id}>
                                    {tag.name}
                                </option>
                            ))}
                        </select>

                        {selectedTagId || searchQuery || statusFilter !== 'ALL' || dateFilter !== 'ALL_TIME' ? (
                            <button
                                onClick={() => {
                                    setSelectedTagId(null);
                                    setSearchQuery('');
                                    setStatusFilter('ALL');
                                    setDateFilter('ALL_TIME');
                                }}
                                className="px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Clear
                            </button>
                        ) : null}

                        {/* Refresh Button */}
                        <button onClick={() => fetchMeetings()} className="p-2.5 text-slate-400 hover:text-violet-600 transition-colors bg-slate-50 rounded-xl hover:bg-violet-50" aria-label="Refresh meetings">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="px-6 md:px-12 relative z-10 max-w-7xl mx-auto w-full">
                {/* Meeting List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p>Loading your library...</p>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-violet-50 text-violet-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileAudio size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No meetings found</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">Upload a file or start recording to get started with your transcription library.</p>
                        <Link href="/record">
                            <Button size="lg" className="shadow-lg shadow-violet-500/20">Record New Meeting</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {meetings.map((meeting) => {
                            const isProcessing = ['UPLOADING', 'UPLOADED', 'PROCESSING_TRANSCRIPT', 'PROCESSING_MINUTES'].includes(meeting.status);

                            return (
                                <div
                                    key={meeting.id}
                                    onClick={() => !isProcessing && router.push(`/meetings/${meeting.id}`)}
                                    className={`bg-white py-3 px-4 rounded-xl shadow-sm border border-slate-100 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1 relative overflow-hidden ${selectedIds.has(meeting.id) ? 'ring-2 ring-violet-500 bg-violet-50/10' : ''} ${recentlyCompletedIds.has(meeting.id) ? 'animate-celebration' : ''} ${isProcessing ? 'cursor-wait' : 'cursor-pointer'}`}
                                >
                                    {/* Selection Checkbox - Always visible for mobile accessibility */}
                                    <div
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20"
                                        onClick={(e) => { e.stopPropagation(); handleSelect(meeting.id); }}
                                    >
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors shadow-sm cursor-pointer ${selectedIds.has(meeting.id) ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white border-slate-300 active:border-violet-500'}`}>
                                            {selectedIds.has(meeting.id) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                                        </div>
                                    </div>

                                    {/* Status Badge + Cancel Button - Top Right */}
                                    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                                        <StatusBadge status={meeting.status} />
                                        {isProcessing && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Cancel processing? The audio file will be kept and you can retry later.')) {
                                                        handleCancel(meeting.id);
                                                    }
                                                }}
                                                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                                title="Cancel processing"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 pl-10 pr-20">
                                        {/* Source Icon - Small inline */}
                                        {(() => {
                                            const isRecorded = meeting.originalFileName?.startsWith('recording_');
                                            const isFailed = meeting.status === 'FAILED';

                                            if (isProcessing) {
                                                return (
                                                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                                        <Loader2 size={18} className="animate-spin" />
                                                    </div>
                                                );
                                            }
                                            if (isFailed) {
                                                return (
                                                    <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                        <AlertCircle size={18} />
                                                    </div>
                                                );
                                            }
                                            if (isRecorded) {
                                                return (
                                                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                                        <Mic size={18} />
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                    <Upload size={18} />
                                                </div>
                                            );
                                        })()}

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-slate-800 text-sm md:text-base truncate">
                                                {meeting.title || `Meeting ${meeting.id.slice(0, 8)}`}
                                            </h3>

                                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {formatDate(meeting.createdAt)}
                                                </span>
                                                {meeting.durationSeconds && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDuration(meeting.durationSeconds)}
                                                    </span>
                                                )}
                                                {(meeting as Meeting & { tags?: { id: string, name: string, color: string }[] }).tags && (meeting as Meeting & { tags?: { id: string, name: string, color: string }[] }).tags!.length > 0 && (
                                                    <div className="hidden md:flex items-center gap-1 pl-2 border-l border-slate-200">
                                                        <TagList tags={(meeting as Meeting & { tags?: { id: string, name: string, color: string }[] }).tags!} max={2} size="sm" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Progress Bar if processing */}
                                            {isProcessing && (
                                                <PipelineProgress
                                                    meetingId={meeting.id}
                                                    initialStatus={meeting.status}
                                                    compact
                                                    className="mt-2"
                                                    onComplete={() => {
                                                        updateMeetingStatus(meeting.id, 'COMPLETED');
                                                        setRecentlyCompletedIds(prev => new Set(prev).add(meeting.id));
                                                        // Show toast with deep link
                                                        toast.addToast({
                                                            type: 'success',
                                                            title: 'Transcription Complete',
                                                            message: `"${meeting.title || 'Your meeting'}" is ready to view`,
                                                            action: {
                                                                label: 'View now →',
                                                                href: `/meetings/${meeting.id}`,
                                                            },
                                                            duration: 8000, // Longer duration for action toasts
                                                        });
                                                        setTimeout(() => setRecentlyCompletedIds(prev => {
                                                            const next = new Set(prev);
                                                            next.delete(meeting.id);
                                                            return next;
                                                        }), 5000);
                                                        // Refresh the list to update ordering
                                                        fetchMeetings(true);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Loader for infinite scroll */}
                {/* Load More Button */}
                {hasMore && (
                    <div className="py-6 flex justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium rounded-xl shadow-sm"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Loading...
                                </>
                            ) : (
                                'Load More'
                            )}
                        </Button>
                    </div>
                )}
            </main>

            <ConfirmDialog
                isOpen={!!deleteId}
                title="Delete Meeting?"
                message="This will permanently delete this meeting. Action cannot be undone."
                confirmText="Delete"
                variant="danger"
                isLoading={deleting}
                onConfirm={() => deleteId && handleDelete(deleteId)}
                onCancel={() => setDeleteId(null)}
            />

            <ConfirmDialog
                isOpen={showBatchDeleteConfirm}
                title={`Delete ${selectedIds.size} Items?`}
                message={`Permanently delete ${selectedIds.size} selected meetings?`}
                confirmText="Delete Selected"
                variant="danger"
                isLoading={batchDeleting}
                onConfirm={handleBatchDelete}
                onCancel={() => setShowBatchDeleteConfirm(false)}
            />

            <ManageTagsDialog
                isOpen={showManageTags}
                onClose={() => setShowManageTags(false)}
                onTagsUpdated={() => {
                    fetchTags();
                    fetchMeetings(false);
                }}
            />

            <FloatingActionBar
                isOpen={selectedIds.size > 0}
                selectedCount={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
            >
                <Button
                    variant="danger"
                    size="sm"
                    className="shadow-md bg-red-500 hover:bg-red-600 text-white border-none"
                    onClick={() => setShowBatchDeleteConfirm(true)}
                >
                    <Trash2 size={16} className="mr-2" />
                    Delete Selected
                </Button>
            </FloatingActionBar>

        </div>
    );
}
