'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, CSSProperties } from 'react';
import { List, ListImperativeAPI } from 'react-window';
import { useDynamicRowHeight } from 'react-window';
import { Edit2, Play, CheckCircle2, HelpCircle, Navigation, Check } from 'lucide-react';
import { InaudibleCorrectionPopup } from './InaudibleCorrectionPopup';
import { SegmentLanguages } from './LanguageFilter';

interface TranscriptSegment {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    originalText?: string;
    speakerId?: string;
    languagesUsed?: string[];
    speaker?: {
        id: string;
        name: string;
        nameConfidence?: number;
        isConfirmed?: boolean;
    };
}

interface TranscriptViewerProps {
    transcript: TranscriptSegment[];
    currentTime: number;
    onSegmentClick: (segment: TranscriptSegment) => void;
    onSpeakerClick: (speakerId: string) => void;
    onTranscriptUpdated?: () => void;
    highlightedSegments?: number[];
    onSegmentUpdate?: (segmentId: string, text: string) => Promise<void>;
    onResetToOriginal?: (segmentId: string) => Promise<void>;
}

// Enhanced speaker colors with better contrast
const SPEAKER_COLORS = [
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-500' },
    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', accent: 'bg-violet-500' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-500' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-500' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', accent: 'bg-cyan-500' },
];

// Default row height estimate
const DEFAULT_ROW_HEIGHT = 100;

// Helper functions
function getSpeakerColor(speakerId?: string) {
    if (!speakerId) return SPEAKER_COLORS[0];
    const index = speakerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % SPEAKER_COLORS.length;
    return SPEAKER_COLORS[index];
}

function getSpeakerConfidenceIcon(speaker: TranscriptSegment['speaker']) {
    if (!speaker) return null;
    if (speaker.isConfirmed) {
        return (
            <span title="Confirmed speaker">
                <CheckCircle2 size={12} className="text-green-500" />
            </span>
        );
    }
    if ((speaker.nameConfidence ?? 0) < 0.5) {
        return (
            <span title={`Confidence: ${Math.round((speaker.nameConfidence ?? 0) * 100)}%`}>
                <HelpCircle size={12} className="text-amber-500" />
            </span>
        );
    }
    return null;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Props passed to each row via rowProps
interface RowExtraProps {
    transcript: TranscriptSegment[];
    currentTime: number;
    onSegmentClick: (segment: TranscriptSegment) => void;
    onSpeakerClick: (speakerId: string) => void;
    setCorrectionPopup: (popup: { segmentId: string; originalText: string; position: { x: number; y: number } } | null) => void;
    highlightedSegments?: number[];
    onSegmentUpdate?: (segmentId: string, text: string) => Promise<void>;
    onResetToOriginal?: (segmentId: string) => Promise<void>;
}



// Row component for the virtualized list
// Row component for the virtualized list
function TranscriptRow({
    index,
    style,
    data,
}: {
    index: number;
    style: CSSProperties;
    data: RowExtraProps;
}) {
    const {
        transcript,
        currentTime,
        onSegmentClick,
        onSpeakerClick,
        setCorrectionPopup,
        highlightedSegments,
        onSegmentUpdate,
        onResetToOriginal,
    } = data;
    const segment = transcript[index];
    const isActive = currentTime >= segment.startTime && currentTime < segment.endTime;
    const isPast = currentTime >= segment.endTime;
    const isHighlighted = highlightedSegments?.includes(index);
    const speakerColor = getSpeakerColor(segment.speaker?.id);

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(segment.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            // Reset height to auto to get scrollHeight, then set
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (editText.trim() !== segment.text) {
            await onSegmentUpdate?.(segment.id, editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(segment.text);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Render text with inaudible highlighting
    const renderTextWithInaudible = (text: string, segmentId: string) => {
        const parts = text.split(/(\[inaudible\]|\[unclear[^\]]*\])/gi);
        return parts.map((part, idx) => {
            if (part.toLowerCase().includes('[inaudible]') || part.toLowerCase().includes('[unclear')) {
                return (
                    <span
                        key={idx}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isEditing) {
                                setCorrectionPopup({
                                    segmentId,
                                    originalText: part,
                                    position: { x: e.clientX, y: e.clientY },
                                });
                            }
                        }}
                        className="bg-red-100 text-red-700 px-1 py-0.5 rounded border-b-2 border-red-400 cursor-pointer hover:bg-red-200 transition-colors"
                        title="Click to fix - audio was unclear"
                    >
                        {part}
                    </span>
                );
            }
            return <span key={idx}>{part}</span>;
        });
    };

    return (
        <div style={style}>
            <div
                className={`
                    group relative p-4 rounded-[16px] transition-all duration-300 border cursor-pointer mx-5 mb-3
                    ${isEditing
                        ? 'bg-surface shadow-lg ring-2 ring-primary border-primary z-10 scale-[1.01]'
                        : isHighlighted
                            ? 'bg-amber-50 border-amber-300 shadow-lg shadow-amber-200/50 ring-2 ring-amber-400/50 animate-pulse'
                            : isActive
                                ? 'bg-primary/5 border-primary/40 shadow-lg shadow-primary/10 scale-[1.01] ring-1 ring-primary/20'
                                : isPast
                                    ? 'bg-surface/40 border-transparent opacity-70 hover:opacity-100 hover:bg-surface hover:border-border/50'
                                    : 'bg-surface/60 border-transparent hover:bg-surface hover:border-border/50 hover:shadow-sm'
                    }
                `}
                onClick={() => {
                    if (!isEditing) onSegmentClick(segment);
                }}
            >
                {/* Active indicator bar with pulse animation */}
                {isActive && !isEditing && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full">
                        <div className="absolute inset-0 bg-primary rounded-full animate-pulse" />
                    </div>
                )}

                <div className="flex flex-col gap-2 pl-2">
                    {/* Header: Time & Speaker Info on same row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSegmentClick(segment);
                            }}
                            className={`
                                flex items-center gap-1.5 text-xs font-mono font-medium 
                                hover:underline text-left transition-colors
                                ${isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'}
                            `}
                        >
                            <Play size={10} className={isActive ? 'text-primary fill-primary' : 'opacity-0 group-hover:opacity-100'} />
                            {formatTime(segment.startTime)}
                        </button>

                        {segment.speaker && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSpeakerClick(segment.speaker!.id);
                                }}
                                className={`
                                    flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-all duration-200
                                    ${speakerColor.bg} ${speakerColor.text} ${speakerColor.border}
                                    hover:brightness-95 hover:shadow-sm
                                `}
                                title="Click to edit speaker"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${speakerColor.accent}`} />
                                <span className="font-medium truncate max-w-[150px]">{segment.speaker.name}</span>
                                {getSpeakerConfidenceIcon(segment.speaker)}
                            </button>
                        )}


                        {/* Language badges */}
                        {segment.languagesUsed && segment.languagesUsed.length > 1 && (
                            <SegmentLanguages languages={segment.languagesUsed} />
                        )}
                    </div>

                    {/* Text Content */}
                    <div className="relative">
                        {isEditing ? (
                            <div className="relative group/edit">
                                <textarea
                                    ref={textareaRef}
                                    value={editText}
                                    onChange={(e) => {
                                        setEditText(e.target.value);
                                        // Auto-resize
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent text-text-main text-base leading-relaxed resize-none outline-none overflow-hidden font-medium min-h-[1.5em] p-1 border-b border-primary/20 focus:border-primary transition-colors"
                                    placeholder="Type transcript here..."
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center gap-2 mt-2 justify-end">
                                    {onResetToOriginal && segment.originalText && editText !== segment.originalText && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await onResetToOriginal(segment.id);
                                                setIsEditing(false);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors font-medium border border-amber-200"
                                            title="Reset to original transcription"
                                        >
                                            Reset
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                        className="text-xs px-3 py-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors font-medium border border-transparent hover:border-border"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium shadow-sm flex items-center gap-1.5"
                                    >
                                        <Check size={12} />
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`
                                    text-base leading-relaxed transition-colors duration-300 pr-8
                                    ${isActive ? 'text-text-main font-medium' : 'text-text-secondary'}
                                `}
                                onClick={(e) => {
                                    if (e.detail === 2) {
                                        e.stopPropagation();
                                        setIsEditing(true);
                                    }
                                }}
                            >
                                {renderTextWithInaudible(segment.text, segment.id)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Right Edit Button - Hidden while editing */}
                {!isEditing && (
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="p-1.5 rounded-lg text-text-muted/40 hover:text-primary hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100"
                            title="Edit text"
                        >
                            <Edit2 size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function TranscriptViewer({
    transcript,
    currentTime,
    onSegmentClick,
    onSpeakerClick,
    onTranscriptUpdated,
    highlightedSegments,
    onSegmentUpdate,
    onResetToOriginal,
}: TranscriptViewerProps) {
    const listRef = useRef<ListImperativeAPI | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [userScrolled, setUserScrolled] = useState(false);
    const lastScrollTime = useRef<number>(0);
    const [correctionPopup, setCorrectionPopup] = useState<{
        segmentId: string;
        originalText: string;
        position: { x: number; y: number };
    } | null>(null);

    // Container ref and height for virtualized list
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(500);

    // Use dynamic row height for variable content
    const dynamicRowHeight = useDynamicRowHeight({
        defaultRowHeight: DEFAULT_ROW_HEIGHT,
    });

    // Find active segment index
    const activeIndex = useMemo(() => {
        return transcript.findIndex(
            seg => currentTime >= seg.startTime && currentTime < seg.endTime
        );
    }, [transcript, currentTime]);

    // Resize observer to get explicit container height
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = entry.contentRect.height;
                if (height > 0) {
                    setContainerHeight(height);
                }
            }
        });

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    // Auto-scroll to active segment
    useEffect(() => {
        if (autoScroll && activeIndex >= 0 && listRef.current) {
            lastScrollTime.current = Date.now();
            listRef.current.scrollToRow({ index: activeIndex, align: 'center', behavior: 'smooth' });
        }
    }, [activeIndex, autoScroll]);

    // Handle user scroll - temporarily disable auto-scroll
    const handleScroll = useCallback(() => {
        // If autoscroll triggered this scroll, ignore
        if (Date.now() - lastScrollTime.current < 500) return;

        if (autoScroll) {
            setAutoScroll(false);
            setUserScrolled(true);
        }
    }, [autoScroll]);

    // Re-enable auto-scroll
    const handleEnableAutoScroll = useCallback(() => {
        setAutoScroll(true);
        setUserScrolled(false);
        if (activeIndex >= 0 && listRef.current) {
            listRef.current.scrollToRow({ index: activeIndex, align: 'center', behavior: 'smooth' });
        }
    }, [activeIndex]);

    // Row props to pass to each row (excluding index and style which are auto-injected)
    const rowProps = useMemo(() => ({
        transcript,
        currentTime,
        onSegmentClick,
        onSpeakerClick,
        setCorrectionPopup,
        highlightedSegments,
        onSegmentUpdate,
        onResetToOriginal,
    }), [transcript, currentTime, onSegmentClick, onSpeakerClick, highlightedSegments, onSegmentUpdate, onResetToOriginal]);

    // Force re-render when transcript changes\n    const transcriptKey = useMemo(() => transcript.length, [transcript]);

    return (
        <>
            <div ref={containerRef} className="flex-1 h-full bg-background/50 relative">
                {transcript.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-text-muted py-16">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <Play size={24} className="text-text-light ml-1" />
                        </div>
                        <p className="font-medium">No transcript available</p>
                        <p className="text-sm text-text-light mt-1">Play the audio to see the transcript</p>
                    </div>
                ) : (
                    <List
                        listRef={listRef}
                        rowCount={transcript.length}
                        rowHeight={dynamicRowHeight}
                        overscanCount={5}
                        onScroll={handleScroll}
                        rowComponent={TranscriptRow}
                        rowProps={{ data: rowProps } as any}
                        style={{ height: containerHeight, width: '100%' }}
                    />
                )}

                {/* Auto-scroll toggle button - shows when user scrolled away */}
                {userScrolled && !autoScroll && activeIndex >= 0 && (
                    <button
                        onClick={handleEnableAutoScroll}
                        className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-hover transition-all hover:scale-105 active:scale-95 z-10 text-sm font-medium"
                        title="Jump to current position"
                    >
                        <Navigation size={16} />
                        <span>Follow</span>
                    </button>
                )}
            </div>

            {/* Correction Popup */}
            {correctionPopup && (
                <InaudibleCorrectionPopup
                    segmentId={correctionPopup.segmentId}
                    originalText={correctionPopup.originalText}
                    position={correctionPopup.position}
                    onClose={() => setCorrectionPopup(null)}
                    onSave={() => {
                        setCorrectionPopup(null);
                        onTranscriptUpdated?.();
                    }}
                />
            )}
        </>
    );
}
