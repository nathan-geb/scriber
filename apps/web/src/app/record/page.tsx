'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { WaveformVisualizer } from '../../components/audio/WaveformVisualizer';
import { Mic, Square, X, UploadCloud, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import fixWebmDuration from 'fix-webm-duration';
import { savePendingUpload, loadPendingUpload, clearPendingUpload } from '../../lib/blobStorage';

export default function RecordPage() {
    const router = useRouter();
    const { token } = useAuth();

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Timer ref
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);

    // Load pending upload on mount
    useEffect(() => {
        loadPendingUpload().then((blob) => {
            if (blob) {
                setAudioBlob(blob);
                // We don't know exact duration, so explicit 0 or unknown is fine, 
                // but maybe we can just show "Ready to Upload"
            }
        });
    }, []);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Timer effect - runs when isRecording changes
    useEffect(() => {
        if (isRecording && startTimeRef.current > 0) {
            // Start the timer interval
            const updateTimer = () => {
                const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setDuration(elapsedSeconds);
            };

            // Initial update
            updateTimer();

            // Set up interval
            intervalRef.current = setInterval(updateTimer, 500);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        }
    }, [isRecording]);

    const startRecording = async () => {
        await clearPendingUpload(); // Clear any previous pending
        setAudioBlob(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(stream);

            // Determine supported mime type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const recordedDurationMs = Date.now() - startTimeRef.current;
                // Calculate duration in seconds from the actual recorded time (not React state)
                const recordedDurationSeconds = Math.ceil(recordedDurationMs / 1000);

                const processBlob = async (finalBlob: Blob) => {
                    setAudioBlob(finalBlob);
                    try {
                        await savePendingUpload(finalBlob); // Save immediately
                    } catch (e) {
                        console.error('Failed to save pending', e);
                    }
                    // Pass the calculated duration directly to avoid closure issues
                    handleUpload(finalBlob, recordedDurationSeconds);
                };

                if (mimeType.includes('webm')) {
                    // Fix WebM duration metadata
                    console.log('[WebM Fix] Applying duration fix:', recordedDurationMs, 'ms');
                    console.log('[WebM Fix] Original blob size:', blob.size);
                    fixWebmDuration(blob, recordedDurationMs, (fixedBlob: Blob) => {
                        console.log('[WebM Fix] Fixed blob size:', fixedBlob.size);
                        console.log('[WebM Fix] Duration metadata patched successfully');
                        processBlob(fixedBlob);
                    });
                } else {
                    processBlob(blob);
                }
            };

            startTimeRef.current = Date.now();
            recorder.start(100); // 100ms timeslices
            setMediaRecorder(recorder);
            setDuration(0); // Reset duration before setting isRecording
            setIsRecording(true); // This triggers the timer useEffect

        } catch (err) {
            console.error('Failed to start recording', err);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    };

    const cancelRecording = async () => {
        if (window.confirm('Discard current recording?')) {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
            }
            setIsRecording(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            setStream(null);
            setDuration(0);
            setAudioBlob(null);
            chunksRef.current = [];
            await clearPendingUpload();
        }
    };

    const handleUpload = async (blob: Blob, uploadDuration?: number) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            // File extension based on mime type
            const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : 'webm';
            const filename = `recording_${new Date().getTime()}.${ext}`;

            formData.append('file', blob, filename);
            formData.append('language', 'en'); // Default to english for now
            // Pass recorded duration for WebM fallback (server may not extract it reliably)
            // Use explicit uploadDuration if provided (from onstop), otherwise fallback to state (for retries)
            const finalDuration = uploadDuration !== undefined ? uploadDuration : duration;
            formData.append('duration', finalDuration.toString());

            const res = await fetch(apiEndpoint('/uploads'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                await clearPendingUpload(); // Clear on success
                // Redirect to meetings list to see processing progress
                router.push('/meetings');
            } else {
                const err = await res.json();
                alert(`Upload failed: ${err.message}`);
                setIsUploading(false); // Only reset if failed, otherwise we redirect
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Upload failed. Please check your connection.');
            setIsUploading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-900 pb-32 relative selection:bg-violet-200 overflow-x-hidden">
            {/* Header Background - Gradient with Depth */}
            <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] z-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Header Content */}
            <header className="px-6 md:px-12 pt-14 pb-8 flex flex-col gap-6 relative z-20 max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                            aria-label="Go Back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p className="text-violet-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5">Capture</p>
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">New Recording.</h1>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <Navbar />
                    </div>
                </div>
            </header>

            <main className="px-6 md:px-12 relative z-10 max-w-4xl mx-auto w-full">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-16 flex flex-col items-center min-h-[500px] justify-center relative overflow-hidden">

                    {/* Dynamic Status Pill */}
                    <div className="mb-12 relative z-10">
                        {isRecording || isUploading ? (
                            <div className="flex items-center gap-4 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
                                {isUploading ? (
                                    <UploadCloud size={20} className="animate-bounce" />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                                )}

                                <span className="font-mono font-medium text-lg min-w-[3rem] text-center">
                                    {formatDuration(duration)}
                                </span>
                                <div className="w-px h-4 bg-white/20" />
                                <span className="text-sm font-medium text-slate-300">
                                    {isUploading ? 'Uploading...' : 'High Quality'}
                                </span>
                            </div>
                        ) : (
                            <div className="h-14 flex items-center text-slate-500 text-lg font-medium">
                                {audioBlob ? (
                                    <span className="text-violet-600 flex items-center gap-2 bg-violet-50 px-4 py-2 rounded-full font-semibold">
                                        <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                                        Recording Saved
                                    </span>
                                ) : (
                                    <span className="opacity-60">Ready to capture</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Visualizer Area */}
                    <div className="w-full max-w-3xl h-64 mb-16 relative flex items-center justify-center z-0">
                        {isRecording ? (
                            <WaveformVisualizer
                                stream={stream}
                                isRecording={isRecording}
                                className="w-full h-full"
                                barColor="rgb(139, 92, 246)" // Violet-500
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center opacity-10 gap-4 w-full">
                                {/* Placeholder Waveform Look */}
                                <div className="flex items-center justify-center gap-1 h-32 w-full">
                                    {[20, 45, 70, 35, 85, 55, 40, 90, 30, 65, 50, 80, 25, 60, 75, 45, 35, 95, 40, 70, 55, 85, 30, 60, 50, 40, 75, 25, 65, 45].map((h, i) => (
                                        <div key={i} className="w-3 bg-slate-900 rounded-full" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    {isUploading ? (
                        <div className="text-center text-violet-600 animate-pulse font-medium">
                            Processing meeting...
                        </div>
                    ) : (
                        <div className="flex items-center gap-12 relative z-10">
                            {/* Discard Button (Visible during recording OR if we have a saved blob) */}
                            {(isRecording || audioBlob) && (
                                <button
                                    onClick={cancelRecording}
                                    className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                    title="Discard Recording"
                                    aria-label="Discard Recording"
                                >
                                    <X size={24} />
                                </button>
                            )}

                            {/* Main Action Button */}
                            {audioBlob && !isRecording ? (
                                // Retry / Confirmed Upload Button
                                <button
                                    onClick={() => handleUpload(audioBlob)}
                                    className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 flex items-center justify-center text-white shadow-xl hover:shadow-2xl shadow-orange-500/30 hover:scale-105 transition-all"
                                    title="Upload Recording"
                                    aria-label="Upload Recording"
                                >
                                    <UploadCloud size={32} />
                                </button>
                            ) : (
                                // Mic Button
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`
                                        relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl
                                        ${isRecording
                                            ? 'bg-red-500 hover:bg-red-600 scale-100 shadow-red-500/30'
                                            : 'bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 hover:scale-105 shadow-violet-500/30'
                                        }
                                    `}
                                    aria-label={isRecording ? "Stop Recording" : "Start Recording"}
                                >
                                    {/* Ripple Effect ring behind when recording */}
                                    {isRecording && (
                                        <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20" />
                                    )}

                                    {isRecording ? (
                                        <Square size={32} className="fill-white text-white" />
                                    ) : (
                                        <Mic size={40} className="text-white" />
                                    )}
                                </button>
                            )}

                            {/* Spacer to balance layout */}
                            {(isRecording || audioBlob) && (
                                <div className="w-14 h-14" />
                            )}
                        </div>
                    )}

                    <div className="mt-12 text-slate-400 text-center max-w-xs text-sm font-medium">
                        {isRecording
                            ? "Recording in progress..."
                            : audioBlob
                                ? "Recording saved. Upload to process."
                                : "Tap the microphone to start recording your meeting"
                        }
                    </div>
                </div>
            </main>
        </div>
    );
}
