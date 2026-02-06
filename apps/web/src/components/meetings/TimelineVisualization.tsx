'use client';

import React, { useMemo, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface Speaker {
    id: string;
    name: string;
}

interface Segment {
    id: string;
    startTime: number;
    endTime: number;
    speakerId: string;
}

interface KeyMoment {
    id: string;
    timestamp: number;
    label: string;
    type: string;
}

interface TimelineVisualizationProps {
    segments: Segment[];
    speakers: Speaker[];
    keyMoments?: KeyMoment[];
    duration: number;
    currentTime: number;
    onSeek: (time: number) => void;
    isPlaying?: boolean;
    onPlayPause?: () => void;
}

// Color palette for speakers
const SPEAKER_COLORS = [
    '#3B82F6', // blue
    '#10B981', // emerald
    '#8B5CF6', // violet
    '#F59E0B', // amber
    '#EF4444', // red
    '#06B6D4', // cyan
    '#EC4899', // pink
    '#6366F1', // indigo
];

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TimelineVisualization({
    segments,
    speakers,
    keyMoments = [],
    duration,
    currentTime,
    onSeek,
    isPlaying = false,
    onPlayPause,
}: TimelineVisualizationProps) {
    const timelineRef = useRef<HTMLDivElement>(null);

    // Create speaker color map
    const speakerColors = useMemo(() => {
        const map: Record<string, string> = {};
        speakers.forEach((speaker, index) => {
            map[speaker.id] = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
        });
        return map;
    }, [speakers]);

    // Group segments by speaker for lane view
    const speakerLanes = useMemo(() => {
        const lanes: Record<string, Segment[]> = {};
        speakers.forEach(speaker => {
            lanes[speaker.id] = segments.filter(s => s.speakerId === speaker.id);
        });
        return lanes;
    }, [segments, speakers]);

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || duration === 0) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        onSeek(Math.max(0, Math.min(duration, newTime)));
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Header with controls */}
            <div className="p-3 border-b border-border bg-background-secondary flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onPlayPause && (
                        <button
                            onClick={onPlayPause}
                            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
                        >
                            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                        </button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                        <span className="font-mono">{formatTime(currentTime)}</span>
                        <span>/</span>
                        <span className="font-mono">{formatTime(duration)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted">
                        {speakers.length} speaker{speakers.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Main timeline */}
            <div
                ref={timelineRef}
                className="relative h-20 bg-background cursor-pointer group"
                onClick={handleTimelineClick}
            >
                {/* Speaker lanes */}
                <div className="absolute inset-0 flex flex-col">
                    {speakers.map((speaker) => (
                        <div
                            key={speaker.id}
                            className="flex-1 relative border-b border-border/50 last:border-b-0"
                        >
                            {/* Speaker label */}
                            <div className="absolute left-1 top-0.5 z-10 text-[10px] font-medium text-text-muted truncate max-w-[60px]">
                                {speaker.name.split(' ')[0]}
                            </div>

                            {/* Segments for this speaker */}
                            {speakerLanes[speaker.id]?.map(segment => {
                                const left = (segment.startTime / duration) * 100;
                                const width = ((segment.endTime - segment.startTime) / duration) * 100;

                                return (
                                    <div
                                        key={segment.id}
                                        className="absolute top-1 bottom-1 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                                        style={{
                                            left: `${left}%`,
                                            width: `${Math.max(width, 0.5)}%`,
                                            backgroundColor: speakerColors[speaker.id],
                                        }}
                                        title={`${speaker.name}: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Key moments markers */}
                {keyMoments.map(moment => {
                    const left = (moment.timestamp / duration) * 100;
                    return (
                        <div
                            key={moment.id}
                            className="absolute top-0 w-0.5 h-full bg-yellow-500 z-20 opacity-80 hover:opacity-100"
                            style={{ left: `${left}%` }}
                            title={`${moment.label} at ${formatTime(moment.timestamp)}`}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-500 rounded-full" />
                        </div>
                    );
                })}

                {/* Current time indicator */}
                <div
                    className="absolute top-0 w-0.5 h-full bg-primary z-30 transition-all"
                    style={{ left: `${progressPercentage}%` }}
                >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-lg" />
                </div>

                {/* Hover preview line */}
                <div className="absolute top-0 w-px h-full bg-text-muted opacity-0 group-hover:opacity-50 pointer-events-none transition-opacity" />
            </div>

            {/* Time markers */}
            <div className="flex justify-between px-2 py-1 border-t border-border bg-background-secondary text-[10px] text-text-muted font-mono">
                <span>0:00</span>
                <span>{formatTime(duration / 4)}</span>
                <span>{formatTime(duration / 2)}</span>
                <span>{formatTime(duration * 3 / 4)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Speaker legend */}
            <div className="p-2 border-t border-border flex flex-wrap gap-2">
                {speakers.map(speaker => (
                    <div
                        key={speaker.id}
                        className="flex items-center gap-1.5 text-xs text-text-secondary"
                    >
                        <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: speakerColors[speaker.id] }}
                        />
                        <span>{speaker.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
