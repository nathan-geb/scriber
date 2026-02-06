'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { CheckCircle2, Circle, Loader2, XCircle, Upload, FileText, ScrollText } from 'lucide-react';

type PipelineStep = 'upload' | 'transcription' | 'minutes';
type StepStatus = 'pending' | 'queued' | 'processing' | 'uploading' | 'generating' | 'completed' | 'failed';

interface StepState {
    status: StepStatus;
    progress: number;
    error?: string;
}

interface PipelineState {
    upload: StepState;
    transcription: StepState;
    minutes: StepState;
}

interface PipelineStepEvent {
    meetingId: string;
    step: PipelineStep;
    status: StepStatus;
    progress: number;
    error?: string;
    timestamp: string;
}

interface PipelineCompleteEvent {
    meetingId: string;
    success: boolean;
    error?: string;
    timestamp: string;
}

interface PipelineProgressProps {
    meetingId: string;
    initialStatus?: string;
    onComplete?: () => void;
    className?: string;
    compact?: boolean;
}

const STEP_CONFIG = {
    upload: { label: 'Upload', icon: Upload },
    transcription: { label: 'Transcribe', icon: FileText },
    minutes: { label: 'Minutes', icon: ScrollText },
} as const;

const defaultStepState: StepState = { status: 'pending', progress: 0 };

function getInitialState(meetingStatus?: string): PipelineState {
    // Initialize from meeting status if provided
    switch (meetingStatus) {
        case 'UPLOADED':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'queued', progress: 0 },
                minutes: { status: 'pending', progress: 0 },
            };
        case 'PROCESSING_TRANSCRIPT':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'processing', progress: 50 },
                minutes: { status: 'pending', progress: 0 },
            };
        case 'TRANSCRIPT_READY':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'completed', progress: 100 },
                minutes: { status: 'queued', progress: 0 },
            };
        case 'PROCESSING_MINUTES':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'completed', progress: 100 },
                minutes: { status: 'processing', progress: 50 },
            };
        case 'COMPLETED':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'completed', progress: 100 },
                minutes: { status: 'completed', progress: 100 },
            };
        case 'FAILED':
            return {
                upload: { status: 'completed', progress: 100 },
                transcription: { status: 'failed', progress: 0 },
                minutes: { status: 'pending', progress: 0 },
            };
        default:
            return {
                upload: defaultStepState,
                transcription: defaultStepState,
                minutes: defaultStepState,
            };
    }
}

function StepIcon({ status, icon: Icon }: { status: StepStatus; icon: React.ElementType }) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        case 'failed':
            return <XCircle className="h-5 w-5 text-red-500" />;
        case 'processing':
        case 'uploading':
        case 'generating':
            return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
        case 'queued':
            return <Icon className="h-5 w-5 text-blue-400" />;
        default:
            return <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600" />;
    }
}

function getStepStatusLabel(step: PipelineStep, status: StepStatus): string {
    if (status === 'completed') return 'Done';
    if (status === 'failed') return 'Failed';
    if (status === 'pending') return 'Pending';
    if (status === 'queued') return 'Queued';

    switch (step) {
        case 'upload':
            return 'Uploading...';
        case 'transcription':
            return status === 'uploading' ? 'Sending to AI...' : 'Transcribing...';
        case 'minutes':
            return 'Generating...';
    }
}

export function PipelineProgress({
    meetingId,
    initialStatus,
    onComplete,
    className = '',
    compact = false,
}: PipelineProgressProps) {
    const { socket, subscribeToMeeting, unsubscribeFromMeeting } = useSocket();
    const [pipelineState, setPipelineState] = useState<PipelineState>(() =>
        getInitialState(initialStatus)
    );
    const [isComplete, setIsComplete] = useState(initialStatus === 'COMPLETED');

    useEffect(() => {
        if (!socket) return;

        subscribeToMeeting(meetingId);

        const handleStepUpdate = (data: PipelineStepEvent) => {
            if (data.meetingId !== meetingId) return;

            setPipelineState(prev => ({
                ...prev,
                [data.step]: {
                    status: data.status,
                    progress: data.progress,
                    error: data.error,
                },
            }));
        };

        const handleComplete = (data: PipelineCompleteEvent) => {
            if (data.meetingId !== meetingId) return;

            setIsComplete(true);
            if (data.success && onComplete) {
                onComplete();
            }
        };

        socket.on('job:step', handleStepUpdate);
        socket.on('job:complete', handleComplete);

        return () => {
            unsubscribeFromMeeting(meetingId);
            socket.off('job:step', handleStepUpdate);
            socket.off('job:complete', handleComplete);
        };
    }, [socket, meetingId, subscribeToMeeting, unsubscribeFromMeeting, onComplete]);

    // Don't show if all steps are pending (nothing started)
    const allPending = !pipelineState || Object.values(pipelineState).every(s => s.status === 'pending');
    if (allPending && !isComplete) return null;

    // Compact mode: just show icons with connecting lines
    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {(['upload', 'transcription', 'minutes'] as const).map((step, i) => {
                    const state = pipelineState[step];
                    const config = STEP_CONFIG[step];
                    return (
                        <React.Fragment key={step}>
                            <div
                                className="relative group"
                                title={`${config.label}: ${getStepStatusLabel(step, state.status)}`}
                            >
                                <StepIcon status={state.status} icon={config.icon} />
                            </div>
                            {i < 2 && (
                                <div className={`w-4 h-0.5 ${pipelineState[step].status === 'completed'
                                    ? 'bg-green-500'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                    }`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    }

    // Full mode: show timeline with labels
    return (
        <div className={`w-full ${className}`}>
            <div className="flex items-center justify-between">
                {(['upload', 'transcription', 'minutes'] as const).map((step, i) => {
                    const state = pipelineState[step];
                    const config = STEP_CONFIG[step];
                    const isActive = ['processing', 'uploading', 'generating', 'queued'].includes(state.status);

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center">
                                <div className={`
                  p-2 rounded-full border-2 transition-all
                  ${state.status === 'completed' ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}
                  ${state.status === 'failed' ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}
                  ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
                  ${state.status === 'pending' ? 'border-slate-200 dark:border-slate-700' : ''}
                `}>
                                    <StepIcon status={state.status} icon={config.icon} />
                                </div>
                                <span className={`mt-1 text-xs font-medium ${state.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                                    state.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                                        isActive ? 'text-blue-600 dark:text-blue-400' :
                                            'text-slate-400'
                                    }`}>
                                    {config.label}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    {getStepStatusLabel(step, state.status)}
                                </span>
                            </div>

                            {i < 2 && (
                                <div className="flex-1 mx-2">
                                    <div className={`h-0.5 w-full transition-all ${pipelineState[step].status === 'completed'
                                        ? 'bg-green-500'
                                        : 'bg-slate-200 dark:bg-slate-700'
                                        }`} />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Error message if any step failed */}
            {Object.entries(pipelineState).map(([step, state]) =>
                state.error ? (
                    <div key={step} className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                        {state.error}
                    </div>
                ) : null
            )}
        </div>
    );
}
