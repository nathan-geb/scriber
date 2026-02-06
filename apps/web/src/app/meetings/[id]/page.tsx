'use client';

import React, { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { useSocket } from '../../../hooks/useSocket';
import { AudioPlayer, AudioPlayerRef } from '../../../components/audio/AudioPlayer';
import { TranscriptViewer } from '../../../components/meetings/TranscriptViewer';
import { SpeakerEditDialog } from '../../../components/meetings/SpeakerEditDialog';
import { ShareDialog } from '../../../components/meetings/ShareDialog';

import { ChevronLeft, Calendar, Clock, FileText, Download, RefreshCw, Globe, Edit2, Share2, Copy, Check, Pencil, X, AlertTriangle, LogOut, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { TagPicker } from '../../../components/meetings/TagPicker';
import { useToast } from '@/context/ToastContext';

import { ActionsRail } from '../../../components/meetings/ActionsRail';
import { ExportMenu } from '../../../components/meetings/ExportMenu';

interface MeetingTag {
    tagId: string;
    tag: {
        id: string;
        name: string;
        color: string;
    };
}

interface Speaker {
    id: string;
    name: string;
    isConfirmed?: boolean;
    nameConfidence?: number;
}

interface TranscriptSegment {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    originalText?: string;
    speakerId?: string;
    speaker?: Speaker;
    languagesUsed?: string[];
}

interface MeetingDetail {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    fileUrl: string;
    transcript: TranscriptSegment[];
    minutes?: { content: string; language?: string };
    speakers: Speaker[];
    tags?: MeetingTag[];
    qualityScore?: number;
    inaudibleCount?: number;
    avgSpeakerConfidence?: number;
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { token } = useAuth();
    const router = useRouter();
    const { socket, subscribeToMeeting, unsubscribeFromMeeting } = useSocket();
    const toast = useToast();
    const paramsUnwrapped = use(params);
    const id = paramsUnwrapped.id;

    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeTab, setActiveTab] = useState<'transcript' | 'minutes'>('transcript');
    const audioPlayerRef = useRef<AudioPlayerRef>(null);

    // Minutes template state
    const [minutesTemplate, setMinutesTemplate] = useState<'EXECUTIVE' | 'DETAILED' | 'ACTION_ITEMS' | 'COMPREHENSIVE' | 'GENERAL_SUMMARY'>('DETAILED');
    const [translationLang, setTranslationLang] = useState('es');
    const [translatedMinutes, setTranslatedMinutes] = useState<{ content: string; language: string } | null>(null);
    const [minutesLoading, setMinutesLoading] = useState(false);
    const [minutesProgress, setMinutesProgress] = useState(0);

    // Speaker Edit State - explicit type to remove 'any'
    const [editingSpeaker, setEditingSpeaker] = useState<{ id: string; name: string; isConfirmed?: boolean; nameConfidence?: number } | null>(null);
    const [isSpeakerDialogOpen, setIsSpeakerDialogOpen] = useState(false);

    // Share Dialog State
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    // Copy to Clipboard State
    const [copiedType, setCopiedType] = useState<'minutes' | 'transcript' | null>(null);

    // Export FAB State
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Title Edit State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');

    // Keyboard Shortcuts State (Placeholder if needed)

    const [savingTitle, setSavingTitle] = useState(false);

    // Retry State
    const [retrying, setRetrying] = useState(false);

    // Enhance Transcript State
    const [enhancing, setEnhancing] = useState(false);
    const [enhancePreview, setEnhancePreview] = useState<{
        corrections: Array<{
            segmentIndex: number;
            originalText: string;
            correctedText: string;
            reason: string;
        }>;
        speakerNames?: Array<{
            segmentIndex: number;
            currentName: string;
            suggestedName: string;
            evidence: string;
        }>;
    } | null>(null);
    const [highlightedSegments, setHighlightedSegments] = useState<number[]>([]);

    // Undo Stack for persistent undo
    interface UndoEntry {
        segmentId: string;
        previousText: string;
        newText: string;
        timestamp: number;
    }
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

    const fetchMeeting = useCallback(async () => {
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setMeeting(data);
            }
        } catch (error) {
            console.error('Failed to fetch meeting:', error);
        } finally {
            setLoading(false);
        }
    }, [token, id]);

    useEffect(() => {
        if (token && id) {
            fetchMeeting();
        }
    }, [token, id, fetchMeeting]);


    // Socket listener for pipeline progress (transcription & minutes)
    useEffect(() => {
        if (!socket) return;

        // Subscribe to this meeting's room for real-time updates
        subscribeToMeeting(id);

        const handlePipelineStep = (data: { meetingId: string; step: string; status: string; progress?: number }) => {
            if (data.meetingId !== id) return;

            // Handle transcription step - refresh when completed
            if (data.step === 'transcription') {
                if (data.status === 'completed') {
                    fetchMeeting(); // Refresh to get the transcript
                } else if (data.status === 'failed') {
                    toast.error('Transcription Failed', 'Audio transcription failed');
                    fetchMeeting(); // Refresh to show failed status
                }
            }

            // Handle minutes step
            if (data.step === 'minutes') {
                if (data.status === 'processing') {
                    setMinutesLoading(true);
                    setMinutesProgress(data.progress || 0);
                } else if (data.status === 'completed') {
                    setMinutesProgress(100);
                    setMinutesLoading(false);
                    fetchMeeting(); // Refresh to get the minutes
                } else if (data.status === 'failed') {
                    setMinutesLoading(false);
                    setMinutesProgress(0);
                    toast.error('Generation Failed', 'Minutes generation failed');
                }
            }
        };

        socket.on('job:step', handlePipelineStep);
        return () => {
            unsubscribeFromMeeting(id);
            socket.off('job:step', handlePipelineStep);
        };
    }, [socket, id, fetchMeeting, toast, subscribeToMeeting, unsubscribeFromMeeting]);

    const handleDownloadAudio = () => {
        if (!meeting?.fileUrl) return;
        const link = document.createElement('a');
        link.href = meeting.fileUrl;
        link.download = `recording-${meeting.title || 'audio'}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadText = () => {
        setIsExportMenuOpen(!isExportMenuOpen);
    };

    const handleDeleteMeeting = async () => {
        if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) return;
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Deleted', 'Meeting deleted successfully');
                router.push('/dashboard');
            } else {
                toast.error('Error', 'Failed to delete meeting');
            }
        } catch (e) {
            console.error('Error deleting meeting:', e);
            toast.error('Error', 'Error deleting meeting');
        }
    };

    const handleCopyContent = () => {
        const content = activeTab === 'transcript'
            ? meeting?.transcript?.map(s => `[${s.speaker?.name || 'Unknown'}]: ${s.text}`).join('\n')
            : meeting?.minutes?.content;

        if (content) {
            navigator.clipboard.writeText(content);
            setCopiedType(activeTab === 'transcript' ? 'transcript' : 'minutes');
            setTimeout(() => setCopiedType(null), 2000);
            toast.success('Copied', 'Content copied to clipboard');
        }
    };

    const handleSpeakerClick = (speakerId: string) => {
        const speaker = meeting?.speakers.find(s => s.id === speakerId);
        if (speaker) {
            setEditingSpeaker(speaker);
            setIsSpeakerDialogOpen(true);
        }
    };

    const handleRenameSpeaker = async (speakerId: string, newName: string) => {
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}/speakers/${speakerId}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newName }),
            });
            if (res.ok) {
                await fetchMeeting(); // Refresh to show new name
                toast.success('Speaker Renamed', `Speaker renamed to "${newName}"`);
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast.error('Rename Failed', errorData.message || 'Could not rename speaker');
                console.error('Rename failed:', res.status, errorData);
            }
        } catch (error) {
            console.error('Failed to rename speaker', error);
            toast.error('Error', 'Failed to rename speaker');
        }
    };

    const handleMergeSpeakers = async (sourceId: string, targetId: string) => {
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}/speakers/${sourceId}/merge`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ targetId }),
            });
            if (res.ok) {
                fetchMeeting(); // Refresh after merge
            }
        } catch (error) {
            console.error('Failed to merge speakers', error);
        }
    };

    const handleConfirmSpeaker = async (speakerId: string) => {
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}/speakers/${speakerId}/confirm`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                fetchMeeting(); // Refresh to show confirmed status
                toast.success('Speaker Confirmed', 'Speaker identity verified');
            } else {
                toast.error('Confirm Failed', 'Could not confirm speaker');
            }
        } catch (error) {
            console.error('Failed to confirm speaker', error);
            toast.error('Error', 'Failed to confirm speaker');
        }
    };

    const handleRegenerateMinutes = async () => {
        setMinutesLoading(true);
        try {
            await fetch(apiEndpoint(`/minutes/${id}/regenerate`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ template: minutesTemplate }),
            });
            // Poll or wait? For now just switch state to "processing" visually by reloading?
            // Actually API triggers a job. We should probably show a toast.
            fetchMeeting();
            alert('Regeneration started. It will update shortly.');
        } catch (error) {
            console.error('Failed to regenerate minutes', error);
        } finally {
            setMinutesLoading(false);
        }
    };

    const handleTranslateMinutes = async () => {
        setMinutesLoading(true);
        try {
            const res = await fetch(apiEndpoint(`/minutes/${id}/translate`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ language: translationLang }),
            });
            if (res.ok) {
                const data = await res.json();
                setTranslatedMinutes({
                    content: data.minutes,
                    language: data.language,
                });
                toast.success('Translated!', `Minutes translated to ${translationLang}`);
            } else {
                toast.error('Error', 'Failed to translate minutes');
            }
        } catch (error) {
            console.error('Failed to translate minutes', error);
            toast.error('Error', 'Failed to translate minutes');
        } finally {
            setMinutesLoading(false);
        }
    };

    const handleCopyMinutes = async () => {
        if (!meeting?.minutes?.content) return;
        try {
            await navigator.clipboard.writeText(meeting.minutes.content);
            setCopiedType('minutes');
            toast.success('Copied!', 'Minutes copied to clipboard');
            setTimeout(() => setCopiedType(null), 2000);
        } catch (err) {
            toast.error('Error', 'Failed to copy to clipboard');
            console.error(err);
        }
    };

    const handleCopyTranscript = async () => {
        if (!meeting?.transcript?.length) return;
        const text = meeting.transcript
            .map((seg) => `${seg.speaker?.name || 'Unknown'}: ${seg.text}`)
            .join('\n\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopiedType('transcript');
            toast.success('Copied!', 'Transcript copied to clipboard');
            setTimeout(() => setCopiedType(null), 2000);
        } catch (err) {
            toast.error('Error', 'Failed to copy to clipboard');
            console.error(err);
        }
    };

    const handleEnhanceTranscript = async () => {
        if (!meeting || enhancing) return;
        setEnhancing(true);
        try {
            // First fetch preview without applying
            const res = await fetch(apiEndpoint(`/transcriptions/${id}/enhance?apply=false`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const hasCorrections = data.corrections && data.corrections.length > 0;
                const hasSpeakerNames = data.speakerNames && data.speakerNames.length > 0;
                if (hasCorrections || hasSpeakerNames) {
                    // Show preview modal
                    setEnhancePreview(data);
                } else {
                    toast.info('No Changes', 'Transcript already looks good - no corrections needed');
                }
            } else {
                toast.error('Error', 'Failed to analyze transcript');
            }
        } catch (err) {
            toast.error('Error', 'Failed to analyze transcript');
            console.error(err);
        } finally {
            setEnhancing(false);
        }
    };

    const handleApplyEnhancements = async () => {
        if (!enhancePreview) return;
        setEnhancing(true);
        try {
            const res = await fetch(apiEndpoint(`/transcriptions/${id}/enhance`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                toast.success('Enhanced!', `Applied ${data.applied} corrections`);

                // Highlight the enhanced segments
                const enhancedIndices = enhancePreview.corrections.map(c => c.segmentIndex);
                setHighlightedSegments(enhancedIndices);

                // Clear highlights after 5 seconds
                setTimeout(() => setHighlightedSegments([]), 5000);

                setEnhancePreview(null);
                fetchMeeting(); // Refresh to show updated transcript
            } else {
                toast.error('Error', 'Failed to apply enhancements');
            }
        } catch (err) {
            toast.error('Error', 'Failed to apply enhancements');
            console.error(err);
        } finally {
            setEnhancing(false);
        }
    };

    const handleSegmentUpdate = async (segmentId: string, text: string) => {
        // Capture the previous text from the current scope for the Undo action
        const currentSegment = meeting?.transcript.find(s => s.id === segmentId);
        const previousText = currentSegment?.text;

        try {
            const res = await fetch(apiEndpoint(`/transcriptions/${id}/segments/${segmentId}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text }),
            });
            if (res.ok) {
                // Optimistically update local state using functional update to prevent race conditions
                setMeeting(prev => {
                    if (!prev) return prev;
                    const updatedTranscript = prev.transcript.map(s =>
                        s.id === segmentId ? { ...s, text } : s
                    );
                    return { ...prev, transcript: updatedTranscript };
                });

                // Push to undo stack (only if this isn't an undo operation itself)
                if (previousText !== undefined && previousText !== text) {
                    setUndoStack(prev => [...prev, {
                        segmentId,
                        previousText,
                        newText: text,
                        timestamp: Date.now()
                    }]);
                }

                toast.success('Saved', 'Transcript updated');

                // Prompt to regenerate minutes if they exist
                if (meeting?.minutes) {
                    setTimeout(() => {
                        toast.info('Minutes Outdated', 'Regenerate based on changes?', {
                            action: {
                                label: 'Regenerate',
                                onClick: handleRegenerateMinutes
                            },
                            duration: 8000
                        });
                    }, 500);
                }
            } else {
                toast.error('Error', 'Failed to save changes');
            }
        } catch (err) {
            toast.error('Error', 'Failed to save changes');
            console.error(err);
        }
    };

    const handleSaveTitle = async () => {
        if (!editedTitle.trim() || editedTitle === meeting?.title) {
            setIsEditingTitle(false);
            return;
        }
        setSavingTitle(true);
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: editedTitle.trim() }),
            });
            if (res.ok) {
                setMeeting(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
                toast.success('Updated', 'Title updated successfully');
            } else {
                toast.error('Error', 'Failed to update title');
            }
        } catch (error) {
            console.error('Failed to update title:', error);
            toast.error('Error', 'Failed to update title');
        } finally {
            setSavingTitle(false);
            setIsEditingTitle(false);
        }
    };

    // Retry failed meeting handler
    const handleRetryMeeting = async () => {
        if (!meeting || meeting.status !== 'FAILED') return;
        setRetrying(true);
        try {
            const res = await fetch(apiEndpoint(`/meetings/${id}/retry`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                toast.success('Processing Resumed', 'Transcription has been re-queued. You\'ll be notified when it\'s ready.');
                router.push('/meetings'); // Navigate to meetings list instead of staying on empty detail
            } else {
                const errorData = await res.json().catch(() => ({}));
                if (errorData.message === 'FILE_MISSING') {
                    toast.error('Original File Lost', 'The audio file is missing from the server. Please re-upload.');
                } else {
                    toast.error('Retry Failed', errorData.message || 'Could not retry meeting');
                }
            }
        } catch (error) {
            console.error('Failed to retry meeting:', error);
            toast.error('Error', 'Failed to retry meeting');
        } finally {
            setRetrying(false);
        }
    };

    // Handle undo - pops last edit from stack and reverts it
    const handleUndo = async () => {
        if (undoStack.length === 0) return;

        const lastEdit = undoStack[undoStack.length - 1];

        try {
            const res = await fetch(apiEndpoint(`/transcriptions/${id}/segments/${lastEdit.segmentId}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text: lastEdit.previousText }),
            });

            if (res.ok) {
                // Update local state
                setMeeting(prev => {
                    if (!prev) return prev;
                    const updatedTranscript = prev.transcript.map(s =>
                        s.id === lastEdit.segmentId ? { ...s, text: lastEdit.previousText } : s
                    );
                    return { ...prev, transcript: updatedTranscript };
                });

                // Remove from undo stack
                setUndoStack(prev => prev.slice(0, -1));

                toast.success('Undone', 'Change reverted');
            } else {
                toast.error('Error', 'Failed to undo');
            }
        } catch (err) {
            toast.error('Error', 'Failed to undo');
            console.error(err);
        }
    };

    // Handle reset to original - restores segment to original transcription
    const handleResetToOriginal = async (segmentId: string) => {
        const segment = meeting?.transcript.find(s => s.id === segmentId);
        if (!segment?.originalText) {
            toast.error('Error', 'Original text not available for this segment');
            return;
        }

        if (segment.text === segment.originalText) {
            toast.info('No Change', 'Text is already at original');
            return;
        }

        try {
            const res = await fetch(apiEndpoint(`/segments/${segmentId}/reset`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                // Update local state
                setMeeting(prev => {
                    if (!prev) return prev;
                    const updatedTranscript = prev.transcript.map(s =>
                        s.id === segmentId ? { ...s, text: segment.originalText! } : s
                    );
                    return { ...prev, transcript: updatedTranscript };
                });

                toast.success('Reset', 'Restored to original transcription');
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast.error('Error', errorData.message || 'Failed to reset');
            }
        } catch (err) {
            toast.error('Error', 'Failed to reset');
            console.error(err);
        }
    };

    // Clear undo stack
    const clearUndoStack = () => {
        setUndoStack([]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Meeting not found</h2>
                <Link href="/meetings" className="text-primary hover:underline">
                    Back to Meetings
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-900 flex flex-col relative selection:bg-violet-200 overflow-x-clip">
            {/* Header Background - Themed gradient */}
            <div className="absolute top-0 left-0 right-0 h-[180px] md:h-[200px] lg:h-[180px] bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] z-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Floating Undo Bar */}
            {undoStack.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom">
                    <span className="text-sm">
                        {undoStack.length} unsaved change{undoStack.length > 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={handleUndo}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-900 rounded-full text-sm font-medium hover:bg-slate-100 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Undo
                    </button>
                    <button
                        onClick={clearUndoStack}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                        title="Dismiss"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="relative z-10 max-w-6xl mx-auto w-full px-4 md:px-8 pt-8 flex-1 flex flex-col gap-6 animate-fade-in mb-8">
                {/* Failed Meeting Banner */}
                {meeting.status === 'FAILED' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <div>
                                <p className="font-medium text-red-700">Processing Failed</p>
                                <p className="text-sm text-red-600">An error occurred during transcription. You can retry processing.</p>
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleRetryMeeting}
                            disabled={retrying}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            <RefreshCw size={16} className={`mr - 2 ${retrying ? 'animate-spin' : ''}`} />
                            {retrying ? 'Retrying...' : 'Retry Processing'}
                        </Button>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between shrink-0 animate-slide-up">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-text-muted hover:text-primary hover:bg-primary-50 rounded-full transition-all hover-lift"
                            title="Go back"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        className="bg-transparent border-b border-primary text-2xl md:text-3xl font-display font-bold text-text-main focus:outline-none focus:border-primary-dark transition-colors px-1 py-0.5"
                                        autoFocus
                                        aria-label="Edit meeting title"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveTitle();
                                            if (e.key === 'Escape') {
                                                setIsEditingTitle(false);
                                                setEditedTitle(meeting?.title || '');
                                            }
                                        }}
                                    />
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleSaveTitle}
                                            disabled={savingTitle}
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        >
                                            <Check size={16} />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setIsEditingTitle(false);
                                                setEditedTitle(meeting?.title || '');
                                            }}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <X size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 group">
                                    <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white/90">
                                        {meeting?.title}
                                    </h1>
                                    <button
                                        onClick={() => {
                                            setEditedTitle(meeting.title);
                                            setIsEditingTitle(true);
                                        }}
                                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary-light rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit title"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center gap-4 mt-1 text-sm text-violet-200/70">
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={14} />
                                    {new Date(meeting.createdAt).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    {new Date(meeting.createdAt).toLocaleTimeString()}
                                </span>
                                {meeting.qualityScore !== undefined && meeting.qualityScore !== null && (
                                    <span
                                        className={`flex items - center gap - 1.5 px - 2 py - 0.5 rounded - full text - xs font - medium ${meeting.qualityScore >= 90 ? 'bg-green-100 text-green-700' :
                                            meeting.qualityScore >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}
                                        title={`${meeting.inaudibleCount || 0} unclear sections`}
                                    >
                                        Quality: {meeting.qualityScore}%
                                    </span>
                                )}
                            </div>
                            {/* Tags */}
                            <div className="mt-2">
                                <TagPicker
                                    meetingId={meeting.id}
                                    meetingTags={meeting.tags || []}
                                    onTagsUpdated={fetchMeeting}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                    {/* Left Column: Media & Info */}
                    <div className="lg:col-span-2 flex flex-col gap-6 min-h-0 h-full">
                        {/* Audio Player - Sticky */}
                        <div className="shrink-0 sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-border/10">
                            {token && (
                                <AudioPlayer
                                    ref={audioPlayerRef}
                                    audioUrl={`${apiEndpoint(`/meetings/${meeting.id}/audio`)}?token=${encodeURIComponent(token)}`}
                                    onTimeUpdate={setCurrentTime}
                                />
                            )
                            }
                            {
                                !token && (
                                    <div className="bg-surface border border-border rounded-xl p-4 text-center text-text-muted">
                                        Loading audio...
                                    </div>
                                )
                            }
                        </div >

                        {/* Content Tabs - Expanded */}
                        <div className="flex-1 card-premium flex flex-col min-h-[500px] overflow-hidden shadow-sm rounded-xl">
                            <div className="flex border-b border-border bg-surface/50">
                                <button
                                    onClick={() => setActiveTab('transcript')}
                                    className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'transcript'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface-hover'
                                        }`}
                                >
                                    Transcript
                                </button>
                                <button
                                    onClick={() => setActiveTab('minutes')}
                                    className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'minutes'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface-hover'
                                        }`}
                                >
                                    Minutes
                                </button>
                                {/* Enhance Button - Only for Transcript */}
                                {activeTab === 'transcript' && (
                                    <button
                                        onClick={handleEnhanceTranscript}
                                        disabled={enhancing}
                                        className="px-4 py-3 text-text-muted hover:text-amber-500 transition-colors border-b-2 border-transparent hover:bg-surface-hover disabled:opacity-50 flex items-center gap-1.5"
                                        title="Enhance transcript with AI corrections"
                                    >
                                        <Sparkles size={16} className={enhancing ? 'animate-pulse text-amber-500' : ''} />
                                        <span className="text-xs font-medium">{enhancing ? 'Enhancing...' : 'Enhance'}</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                {activeTab === 'transcript' ? (
                                    <TranscriptViewer
                                        transcript={meeting.transcript}
                                        currentTime={currentTime}
                                        onSegmentClick={(seg) => {
                                            // Seek audio to segment start time
                                            audioPlayerRef.current?.seekTo(seg.startTime);
                                        }}
                                        onSpeakerClick={handleSpeakerClick}
                                        highlightedSegments={highlightedSegments}
                                        onSegmentUpdate={handleSegmentUpdate}
                                        onResetToOriginal={handleResetToOriginal}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col">
                                        <div className="p-4 border-b border-border bg-surface-hover/30 flex flex-wrap gap-4 items-center justify-between shrink-0">

                                            {/* Regenerate Controls */}
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={minutesTemplate}
                                                    onChange={(e) => setMinutesTemplate(e.target.value as 'EXECUTIVE' | 'DETAILED' | 'ACTION_ITEMS' | 'COMPREHENSIVE' | 'GENERAL_SUMMARY')}
                                                    className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background focus-ring-premium transition-shadow cursor-pointer"
                                                    title="Select Template"
                                                >
                                                    <option value="COMPREHENSIVE">Full Minutes</option>
                                                    <option value="GENERAL_SUMMARY">General Summary</option>
                                                    <option value="EXECUTIVE">Executive Summary</option>
                                                    <option value="DETAILED">Detailed Notes</option>
                                                    <option value="ACTION_ITEMS">Action Items Only</option>
                                                </select>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={handleRegenerateMinutes}
                                                    disabled={minutesLoading}
                                                    className="flex items-center gap-2 hover-lift"
                                                >
                                                    <RefreshCw size={14} className={minutesLoading ? 'animate-spin' : ''} />
                                                    Regenerate
                                                </Button>
                                            </div>

                                            {/* Translate Controls */}
                                            <div className="flex items-center gap-2">
                                                <Globe size={16} className="text-text-muted" />
                                                <select
                                                    value={translationLang}
                                                    onChange={(e) => setTranslationLang(e.target.value)}
                                                    className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background focus-ring-premium w-36 cursor-pointer"
                                                    title="Select Language"
                                                >
                                                    <option value="en">English</option>
                                                    <option value="am">Amharic</option>
                                                    <option value="ar">Arabic</option>
                                                    <option value="zh">Chinese</option>
                                                    <option value="fr">French</option>
                                                    <option value="de">German</option>
                                                    <option value="hi">Hindi</option>
                                                    <option value="it">Italian</option>
                                                    <option value="ja">Japanese</option>
                                                    <option value="ko">Korean</option>
                                                    <option value="pt">Portuguese</option>
                                                    <option value="ru">Russian</option>
                                                    <option value="es">Spanish</option>
                                                    <option value="sw">Swahili</option>
                                                </select>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleTranslateMinutes}
                                                    disabled={minutesLoading}
                                                    className="hover-lift"
                                                >
                                                    Translate
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="p-6 overflow-y-auto flex-1 prose prose-slate max-w-none prose-headings:text-text-main prose-p:text-text-secondary prose-li:text-text-secondary relative">
                                            {/* Loading overlay for minutes generation */}
                                            {minutesLoading && (
                                                <div className="absolute inset-0 bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center z-10 animate-fade-in">
                                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                                                    <p className="text-text-main font-medium">Generating Minutes</p>
                                                    {minutesProgress > 0 && <p className="text-sm text-text-muted mt-2">{minutesProgress}%</p>}
                                                    <p className="text-xs text-text-muted mt-1">This may take a moment...</p>
                                                </div>
                                            )}
                                            {meeting.minutes ? (
                                                <>
                                                    {translatedMinutes && (
                                                        <div className="mb-4 flex items-center gap-3">
                                                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                                                                <Globe size={14} />
                                                                Translated: {translatedMinutes.language.toUpperCase()}
                                                            </span>
                                                            <button
                                                                onClick={() => setTranslatedMinutes(null)}
                                                                className="text-xs text-text-muted hover:text-primary underline"
                                                            >
                                                                Show Original
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="prose prose-sm max-w-none prose-headings:text-text-main prose-p:text-text-secondary prose-strong:text-text-main prose-li:text-text-secondary">
                                                        <ReactMarkdown>
                                                            {translatedMinutes ? translatedMinutes.content : meeting.minutes.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center text-text-muted py-10">
                                                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                                    <p>No minutes generated yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div >
                    </div >

                    {/* Right Column: Speakers List (Optional Sidebar) */}
                    < div className="hidden lg:flex flex-col gap-6" >
                        {/* Speakers List Summary */}
                        < div className="bg-surface border border-border rounded-xl p-4" >
                            <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
                                <UsersIcon className="w-4 h-4" />
                                Speakers
                            </h3>
                            <div className="space-y-3">
                                {meeting.speakers.map(speaker => (
                                    <div
                                        key={speaker.id}
                                        onClick={() => handleSpeakerClick(speaker.id)}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover cursor-pointer group transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${getSpeakerColorDot(speaker.id)}`} />
                                            <span className="text-sm font-medium text-text-secondary group-hover:text-text-main">
                                                {speaker.name}
                                            </span>
                                        </div>
                                        <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-text-muted" />
                                    </div>
                                ))}
                            </div>
                        </div >
                    </div >
                </div >

                {/* Desktop Fixed Action Buttons at Bottom */}
                < div className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-2 bg-surface/95 backdrop-blur-sm border border-border rounded-xl p-2 shadow-lg" >
                    <button
                        onClick={() => setIsShareDialogOpen(true)}
                        className="p-2.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                        title="Share"
                    >
                        <Share2 size={18} />
                    </button>
                    <button
                        onClick={handleDownloadAudio}
                        className="p-2.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                        title="Download Audio"
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={handleDownloadText}
                        className="p-2.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                        title="Download Text"
                    >
                        <FileText size={18} />
                    </button>
                    <button
                        onClick={handleDeleteMeeting}
                        className="p-2.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={18} />
                    </button>
                </div >

                {/* Large Screen Export Menu Overlay */}
                {isExportMenuOpen && (
                    <div className="hidden lg:block fixed bottom-24 right-6 z-50">
                        <ExportMenu
                            meetingId={meeting.id}
                            token={token || ''}
                            onClose={() => setIsExportMenuOpen(false)}
                        />
                    </div>
                )}
            </div >

            {/* Speaker Edit Dialog */}
            {
                editingSpeaker && (
                    <SpeakerEditDialog
                        isOpen={isSpeakerDialogOpen}
                        onClose={() => setIsSpeakerDialogOpen(false)}
                        speaker={editingSpeaker}
                        allSpeakers={meeting.speakers}
                        onRename={handleRenameSpeaker}
                        onMerge={handleMergeSpeakers}
                        onConfirm={handleConfirmSpeaker}
                    />
                )
            }

            {/* Share Dialog */}
            <ShareDialog
                meetingId={meeting.id}
                meetingTitle={meeting.title}
                isOpen={isShareDialogOpen}
                onClose={() => setIsShareDialogOpen(false)}
            />

            {/* Enhancement Preview Modal */}
            {
                enhancePreview && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEnhancePreview(null)} />
                        <div className="relative w-full max-w-2xl max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden mx-4">
                            <div className="p-4 border-b border-border bg-surface-hover flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={20} className="text-amber-500" />
                                    <h3 className="font-semibold text-lg">Preview Enhancements</h3>
                                    <span className="text-sm text-text-muted">
                                        ({enhancePreview.corrections.length} corrections
                                        {enhancePreview.speakerNames && enhancePreview.speakerNames.length > 0 &&
                                            `, ${enhancePreview.speakerNames.length} speaker names`})
                                    </span>
                                </div>
                                <button onClick={() => setEnhancePreview(null)} className="text-text-muted hover:text-text-main" title="Close preview">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-4">
                                {/* Speaker Name Suggestions */}
                                {enhancePreview.speakerNames && enhancePreview.speakerNames.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-violet-600 flex items-center gap-2">
                                            👤 Speaker Names Detected
                                        </h4>
                                        {enhancePreview.speakerNames.map((suggestion, idx) => (
                                            <div key={`speaker-${idx}`} className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-violet-600 line-through">{suggestion.currentName}</span>
                                                    <span className="text-text-muted">→</span>
                                                    <span className="text-violet-700 font-semibold">{suggestion.suggestedName}</span>
                                                </div>
                                                <div className="text-xs text-text-muted mt-1 italic">&quot;{suggestion.evidence}&quot;</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Text Corrections */}
                                {enhancePreview.corrections.length > 0 && (
                                    <div className="space-y-2">
                                        {enhancePreview.speakerNames && enhancePreview.speakerNames.length > 0 && (
                                            <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                                                ✏️ Text Corrections
                                            </h4>
                                        )}
                                        {enhancePreview.corrections.map((correction, idx) => (
                                            <div key={idx} className="bg-background rounded-lg p-3 border border-border">
                                                <div className="text-xs text-text-muted mb-2 font-medium">{correction.reason}</div>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div className="bg-red-50 border border-red-200 rounded p-2">
                                                        <div className="text-xs text-red-600 font-medium mb-1">Before</div>
                                                        <div className="text-red-800 line-through">{correction.originalText}</div>
                                                    </div>
                                                    <div className="bg-green-50 border border-green-200 rounded p-2">
                                                        <div className="text-xs text-green-600 font-medium mb-1">After</div>
                                                        <div className="text-green-800">{correction.correctedText}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-border bg-surface-hover flex items-center justify-end gap-3">
                                <Button variant="ghost" onClick={() => setEnhancePreview(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleApplyEnhancements} disabled={enhancing} className="bg-amber-500 hover:bg-amber-600 text-white">
                                    {enhancing ? 'Applying...' : `Apply ${enhancePreview.corrections.length + (enhancePreview.speakerNames?.length || 0)} Changes`}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Desktop Actions Rail & Export Menu - Hidden on lg since we have fixed bottom actions */}
            <div className="hidden md:block lg:hidden">
                {isExportMenuOpen && (
                    <div className="fixed right-20 top-1/2 -translate-y-1/2 z-50">
                        <ExportMenu
                            meetingId={meeting.id}
                            token={token || ''}
                            onClose={() => setIsExportMenuOpen(false)}
                        />
                    </div>
                )}
                <ActionsRail
                    onShare={() => setIsShareDialogOpen(true)}
                    onDownloadAudio={handleDownloadAudio}
                    onDownloadTranscript={handleDownloadText}
                    onDownloadJSON={() => { }} // No JSON export in simplified menu for now, implied in specific formats
                    onDelete={handleDeleteMeeting}
                    onCopy={handleCopyContent}
                    copyType={copiedType}
                />
            </div>

            <div className="md:hidden fixed bottom-24 right-0 z-50">
                <div className="bg-primary/90 backdrop-blur-sm rounded-l-xl shadow-xl py-2 px-1.5 flex flex-col items-center">
                    <button
                        onClick={() => setIsExportMenuOpen(true)}
                        className="w-10 h-10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all font-bold"
                        aria-label="Open Export Menu"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Sheet for Actions */}
            {
                isExportMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExportMenuOpen(false)} />
                        <div className="relative w-full bg-surface border-t border-border rounded-t-3xl p-6 pb-10 shadow-2xl animate-slide-up-mobile max-h-[90vh] overflow-y-auto">
                            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6" />

                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-text-primary">Meeting Actions</h3>

                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-8">
                                <button onClick={() => { setIsShareDialogOpen(true); setIsExportMenuOpen(false); }} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                                        <Share2 size={24} />
                                    </div>
                                    <span className="text-xs font-semibold">Share</span>
                                </button>
                                <button onClick={handleDownloadAudio} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                        <Download size={24} />
                                    </div>
                                    <span className="text-xs font-semibold">Audio</span>
                                </button>
                                <button onClick={handleCopyContent} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                                        <Copy size={24} />
                                    </div>
                                    <span className="text-xs font-semibold">Copy</span>
                                </button>
                                <button onClick={() => { if (confirm('Are you sure?')) handleDeleteMeeting(); }} className="flex flex-col items-center gap-2 text-red-600">
                                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shadow-sm">
                                        <Trash2 size={22} />
                                    </div>
                                    <span className="text-xs font-semibold">Delete</span>
                                </button>
                            </div>

                            <div className="border-t border-border pt-6">
                                <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 px-1">Export Options</h4>
                                <ExportMenu
                                    meetingId={meeting.id}
                                    token={token || ''}
                                    onClose={() => setIsExportMenuOpen(false)}
                                    inline={true}
                                />
                            </div>

                            <div className="mt-8">
                                <Button
                                    variant="outline"
                                    className="w-full py-4 text-base font-bold rounded-2xl border-2"
                                    onClick={() => setIsExportMenuOpen(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// Helper for speaker list dot color (simplified version of TranscriptViewer logic)
function getSpeakerColorDot(id: string) {
    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
    ];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
