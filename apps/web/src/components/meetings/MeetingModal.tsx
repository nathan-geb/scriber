'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TranscriptViewer } from './TranscriptViewer';
import { SpeakerEditDialog } from './SpeakerEditDialog';
import { PipelineProgress } from './PipelineProgress';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
    Calendar,
    Clock,
    FileText,
    ScrollText,
    ExternalLink,
    Loader2,
    Play,
    Copy,
    Check,
    Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

interface Speaker {
    id: string;
    name: string;
    isUnknown?: boolean;
}

interface Meeting {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    durationSeconds?: number;
    fileUrl?: string;
    transcript?: Array<{
        id: string;
        text: string;
        startTime: number;
        endTime: number;
        speaker?: { id: string; name: string };
    }>;
    minutes?: { content: string };
    speakers?: Speaker[];
}

interface MeetingModalProps {
    meetingId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onMeetingUpdated?: () => void;
}

type TabType = 'minutes' | 'transcript';

export function MeetingModal({
    meetingId,
    isOpen,
    onClose,
    onMeetingUpdated,
}: MeetingModalProps) {
    const { token } = useAuth();
    const toast = useToast();
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('minutes');
    const [creatingShare, setCreatingShare] = useState(false);
    const [copied, setCopied] = useState(false);

    // Speaker Edit State
    const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
    const [isSpeakerDialogOpen, setIsSpeakerDialogOpen] = useState(false);

    // Extract fetchMeeting as useCallback so we can call it after speaker edit
    const fetchMeeting = useCallback(async () => {
        if (!meetingId || !token) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${apiEndpoint(API_ENDPOINTS.MEETINGS)}/${meetingId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setMeeting(data);
            }
        } catch (error) {
            console.error('Failed to fetch meeting:', error);
        } finally {
            setLoading(false);
        }
    }, [meetingId, token]);

    // Fetch meeting details when modal opens
    useEffect(() => {
        if (!isOpen || !meetingId || !token) {
            setMeeting(null);
            return;
        }
        fetchMeeting();
    }, [isOpen, meetingId, token, fetchMeeting]);

    const handleSpeakerClick = (speakerId: string) => {
        const speaker = meeting?.speakers?.find(s => s.id === speakerId);
        if (speaker) {
            setEditingSpeaker(speaker);
            setIsSpeakerDialogOpen(true);
        }
    };

    const handleRenameSpeaker = async (speakerId: string, newName: string) => {
        if (!meeting || !token) return;
        try {
            const res = await fetch(apiEndpoint(`/meetings/${meeting.id}/speakers/${speakerId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newName }),
            });
            if (res.ok) {
                await fetchMeeting();
                toast.success('Speaker Renamed', `Speaker renamed to "${newName}"`);
            } else {
                toast.error('Rename Failed', 'Could not rename speaker');
            }
        } catch (error) {
            console.error('Failed to rename speaker', error);
            toast.error('Error', 'Failed to rename speaker');
        }
    };

    const handleMergeSpeakers = async (sourceId: string, targetId: string) => {
        if (!meeting || !token) return;
        try {
            const res = await fetch(apiEndpoint(`/meetings/${meeting.id}/speakers/${sourceId}/merge`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ targetId }),
            });
            if (res.ok) {
                await fetchMeeting();
                toast.success('Speakers Merged', 'Speakers merged successfully');
            } else {
                toast.error('Merge Failed', 'Could not merge speakers');
            }
        } catch (error) {
            console.error('Failed to merge speakers', error);
            toast.error('Error', 'Failed to merge speakers');
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCreateShareLink = async () => {
        if (!meeting || !token) return;
        setCreatingShare(true);
        try {
            const res = await fetch(`${apiEndpoint('/shares')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ meetingId: meeting.id, shareType: 'FULL' }),
            });
            if (!res.ok) throw new Error('Failed to create share link');
            const data = await res.json();
            await navigator.clipboard.writeText(data.shareUrl);
            toast.success('Link Copied!', 'Share link copied to clipboard');
        } catch {
            toast.error('Error', 'Failed to create share link');
        } finally {
            setCreatingShare(false);
        }
    };

    const handleCopyMinutes = async () => {
        if (!meeting?.minutes?.content) return;
        try {
            await navigator.clipboard.writeText(meeting.minutes.content);
            setCopied(true);
            toast.success('Copied!', 'Minutes copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Error', 'Failed to copy to clipboard');
        }
    };

    const isProcessing = meeting && !['COMPLETED', 'FAILED'].includes(meeting.status);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={meeting?.title || 'Meeting Details'}
                size="xl"
            >
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : meeting ? (
                    <div className="space-y-4">
                        {/* Header Info */}
                        <div className="flex items-center gap-4 text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(meeting.createdAt)}
                            </span>
                            {meeting.durationSeconds && (
                                <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {formatDuration(meeting.durationSeconds)}
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-xs ${meeting.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : meeting.status === 'FAILED'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                {meeting.status}
                            </span>
                        </div>

                        {/* Pipeline Progress (if still processing) */}
                        {isProcessing && (
                            <PipelineProgress
                                meetingId={meeting.id}
                                initialStatus={meeting.status}
                                onComplete={() => {
                                    onMeetingUpdated?.();
                                }}
                            />
                        )}

                        {/* Audio placeholder - link to full page for playback */}
                        {meeting.fileUrl && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Play size={18} className="text-primary ml-0.5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-text-main">Audio Recording</p>
                                    <p className="text-xs text-text-muted">Open full page to play audio</p>
                                </div>
                            </div>
                        )}

                        {/* Tab Navigation */}
                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('minutes')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'minutes'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-muted hover:text-text-main'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <ScrollText size={16} />
                                    Minutes
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('transcript')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transcript'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-muted hover:text-text-main'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText size={16} />
                                    Transcript
                                </div>
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="min-h-[300px] max-h-[400px] overflow-auto">
                            {activeTab === 'minutes' ? (
                                meeting.minutes ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                        {meeting.minutes.content}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-text-muted">
                                        <ScrollText className="mx-auto mb-2 opacity-50" size={32} />
                                        <p>Minutes not yet available</p>
                                    </div>
                                )
                            ) : (
                                meeting.transcript && meeting.transcript.length > 0 ? (
                                    <TranscriptViewer
                                        transcript={meeting.transcript}
                                        currentTime={0}
                                        onSegmentClick={() => { }}
                                        onSpeakerClick={handleSpeakerClick}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-text-muted">
                                        <FileText className="mx-auto mb-2 opacity-50" size={32} />
                                        <p>Transcript not yet available</p>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCreateShareLink}
                                    disabled={creatingShare}
                                >
                                    {creatingShare ? (
                                        <Loader2 size={16} className="mr-1 animate-spin" />
                                    ) : (
                                        <LinkIcon size={16} className="mr-1" />
                                    )}
                                    Share Link
                                </Button>
                                {meeting?.minutes?.content && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyMinutes}
                                    >
                                        {copied ? (
                                            <Check size={16} className="mr-1 text-green-500" />
                                        ) : (
                                            <Copy size={16} className="mr-1" />
                                        )}
                                        Copy Minutes
                                    </Button>
                                )}
                            </div>
                            <Link href={`/meetings/${meeting.id}`}>
                                <Button size="sm">
                                    <ExternalLink size={16} className="mr-1" />
                                    View Full Page
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-text-muted">
                        Meeting not found
                    </div>
                )}
            </Modal>

            {/* Speaker Edit Dialog */}
            {
                editingSpeaker && (
                    <SpeakerEditDialog
                        isOpen={isSpeakerDialogOpen}
                        onClose={() => setIsSpeakerDialogOpen(false)}
                        speaker={editingSpeaker}
                        allSpeakers={meeting?.speakers || []}
                        onRename={handleRenameSpeaker}
                        onMerge={handleMergeSpeakers}
                    />
                )
            }
        </>
    );
}
