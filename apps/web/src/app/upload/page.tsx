'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';
import { ArrowLeft, FileAudio, X, RefreshCw, CheckCircle, FileUp } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';

export default function UploadPage() {
    const { token } = useAuth();
    const toast = useToast();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadComplete, setUploadComplete] = useState(false);

    const handleFileUpload = async (file: File) => {
        if (!token) return;

        setSelectedFile(file);
        setUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(apiEndpoint(API_ENDPOINTS.UPLOADS), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Upload failed');
            }

            setUploadComplete(true);
            toast.success('Upload Complete', 'Your recording is being processed');

            // Navigate to meetings list after a short delay
            setTimeout(() => {
                router.push('/meetings');
            }, 1500);
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Upload Failed', (error as Error).message || 'Could not upload file');
            setSelectedFile(null);
        } finally {
            setUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
            handleFileUpload(file);
        } else {
            toast.error('Invalid File', 'Please upload an audio or video file');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    const clearSelection = () => {
        setSelectedFile(null);
        setUploadComplete(false);
        setUploadProgress(0);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                            <p className="text-violet-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5">Import</p>
                            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Upload File.</h1>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <Navbar />
                    </div>
                </div>
            </header>

            <main className="px-6 md:px-12 relative z-10 max-w-4xl mx-auto w-full">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 flex flex-col items-center justify-center relative overflow-hidden">

                    {/* Info section */}
                    <div className="mb-8 text-center max-w-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Select a recording</h2>
                        <p className="text-slate-500">
                            Upload a meeting recording to generate AI-powered transcripts and summaries.
                            <br /><span className="text-xs opacity-75">Supported: MP3, WAV, M4A, MP4, WebM, OGG.</span>
                        </p>
                    </div>

                    {/* Upload Area */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full max-w-xl relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${dragOver
                            ? 'border-violet-500 bg-violet-50/50 scale-[1.02]'
                            : selectedFile
                                ? 'border-violet-200 bg-violet-50/30'
                                : 'border-slate-200 hover:border-violet-400 hover:bg-slate-50'
                            }`}
                    >
                        {selectedFile ? (
                            <div className="space-y-6">
                                <div className="w-20 h-20 mx-auto rounded-3xl bg-violet-100 flex items-center justify-center shadow-inner">
                                    {uploadComplete ? (
                                        <CheckCircle className="text-green-500" size={40} />
                                    ) : uploading ? (
                                        <RefreshCw className="text-violet-600 animate-spin" size={40} />
                                    ) : (
                                        <FileAudio className="text-violet-600" size={40} />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-lg text-slate-900">{selectedFile.name}</p>
                                    <p className="text-sm text-slate-500 font-medium">{formatFileSize(selectedFile.size)}</p>
                                </div>

                                {uploadComplete ? (
                                    <p className="text-green-600 font-bold animate-pulse">
                                        Upload Complete! Redirecting...
                                    </p>
                                ) : uploading ? (
                                    <div className="max-w-xs mx-auto space-y-2">
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                            <div
                                                className="h-full bg-violet-600 transition-all duration-300 relative overflow-hidden"
                                                style={{ width: `${uploadProgress}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                                            </div>
                                        </div>
                                        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Processing...</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm text-slate-400 hover:text-red-500 flex items-center gap-1 mx-auto transition-colors font-medium"
                                    >
                                        <X size={16} /> Remove File
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-20 h-20 mx-auto rounded-3xl bg-violet-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <FileUp className="text-violet-600" size={40} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                                        Drop your audio file here
                                    </h3>
                                    <p className="text-slate-400 font-medium">
                                        or click to browse
                                    </p>
                                </div>
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white shadow-lg shadow-violet-500/20 px-8 py-3 h-auto text-base rounded-xl hover:-translate-y-0.5 transition-all"
                                >
                                    Select File
                                </Button>
                            </div>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="File upload input"
                    />

                    {/* Tips */}
                    <div className="mt-12 p-6 bg-amber-50/50 rounded-2xl border border-amber-100 max-w-2xl w-full">
                        <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            Tips for best results
                        </h4>
                        <ul className="text-sm text-amber-800/80 space-y-2 ml-5 list-disc">
                            <li>Use clear audio recordings with minimal background noise for higher accuracy.</li>
                            <li>Longer recordings may take a few minutes to process.</li>
                            <li>Speakers are automatically detected and labeled in the transcript.</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}
