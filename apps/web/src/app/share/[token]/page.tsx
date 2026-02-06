'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiEndpoint } from '@echomint/core';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, AlertCircle, Calendar, Hash } from 'lucide-react';

interface SharedContent {
    title: string;
    createdAt: string;
    shareType: 'FULL' | 'MINUTES' | 'TRANSCRIPT';
    minutes?: string | null;
    transcript?: {
        speaker: string;
        startTime: number;
        endTime: number;
        text: string;
    }[];
}

export default function SharedMeetingPage() {
    const params = useParams();
    const token = (params?.token as string) || '';

    const [content, setContent] = useState<SharedContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchContent();
        }
    }, [token]);

    const fetchContent = async () => {
        try {
            // Note: This endpoint is public, no auth header needed
            const res = await fetch(apiEndpoint(`/shares/content/${token}`));

            if (!res.ok) {
                if (res.status === 404) throw new Error('Link expired or invalid');
                throw new Error('Failed to load content');
            }

            const data = await res.json();
            setContent(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md w-full">
                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertCircle size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Unavailable</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!content) return null;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{content.title}</h1>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span>{new Date(content.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Hash size={16} />
                            <span>{content.shareType} ACCESS</span>
                        </div>
                    </div>
                </div>

                {/* Minutes */}
                {content.minutes && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                <FileText size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Meeting Minutes</h2>
                        </div>
                        <div className="prose prose-blue max-w-none">
                            <ReactMarkdown>{content.minutes}</ReactMarkdown>
                        </div>
                    </div>
                )}

                {/* Transcript */}
                {content.transcript && content.transcript.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">Transcript</h2>
                        <div className="space-y-6">
                            {content.transcript.map((segment, index) => (
                                <div key={index} className="flex gap-4">
                                    <div className="flex-shrink-0 w-32">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{segment.speaker}</p>
                                        <p className="text-xs text-mono text-gray-500 mt-1">
                                            {new Date(segment.startTime * 1000).toISOString().substr(11, 8)}
                                        </p>
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-gray-700 leading-relaxed">{segment.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
