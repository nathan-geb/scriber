'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMeetings } from '@/hooks/useMeetings';
import { Mic, Square, Zap } from 'lucide-react';

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                ready: () => void;
                expand: () => void;
                close: () => void;
                MainButton: {
                    text: string;
                    show: () => void;
                    hide: () => void;
                    onClick: (fn: () => void) => void;
                };
            };
        };
    }
}

const TelegramMiniApp = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { refresh } = useMeetings();
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('ready');

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    }, []);

    const handleToggleRecording = () => {
        if (!isRecording) {
            setIsRecording(true);
            setStatus('recording');
        } else {
            setIsRecording(false);
            setStatus('uploading');
            setTimeout(() => {
                setStatus('done');
                if (refresh) refresh();
            }, 2000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent border-none">
                    Scriber Mini
                </h1>
                <p className="text-slate-400 text-sm font-medium">Rapid Voice Notes</p>
            </div>

            <div className="relative">
                <button
                    onClick={handleToggleRecording}
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
                            ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse'
                            : 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95'
                        }`}
                >
                    {isRecording ? (
                        <Square className="w-12 h-12 text-white fill-current" />
                    ) : (
                        <Mic className="w-12 h-12 text-white" />
                    )}
                </button>

                {isRecording && (
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/50">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                        <span className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-widest">Recording</span>
                    </div>
                )}
            </div>

            <div className="mt-20 w-full max-w-xs space-y-4">
                <div
                    onClick={() => router.push('/dashboard')}
                    className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/60 transition-all active:scale-95 group"
                >
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                        <Zap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Full Dashboard</p>
                        <p className="text-xs text-slate-500">Access your recordings</p>
                    </div>
                </div>

                <div className="text-center bg-slate-800/20 py-2 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        Status: <span className={status === 'recording' ? 'text-red-400' : 'text-emerald-400'}>{status}</span>
                    </p>
                </div>
            </div>

            {user && (
                <div className="absolute bottom-8 left-0 right-0 text-center opacity-40">
                    <p className="text-[10px] text-slate-400">
                        Account: <span className="font-mono">{user.email}</span>
                    </p>
                </div>
            )}
        </div>
    );
};

export default TelegramMiniApp;
