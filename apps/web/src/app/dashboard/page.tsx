'use client';

import { useAuth } from '@/context/AuthContext';
import { useMeetings, Meeting } from '@/hooks/useMeetings';
import {
    Mic,
    Upload,
    Bell,
    ChevronRight,
    Play,
    AlertCircle,
    Loader2,
    Calendar,
    Clock,
    Sparkles,
    ArrowUpRight,
    Send,
    Check,
    Copy,
    ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CircularProgress } from '@/components/ui/CircularProgress';
import { Navbar } from '@/components/layout/Navbar';

function TelegramLinkButton() {
    const [code, setCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const { token } = useAuth();

    const generateCode = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/users/telegram-link`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.code) {
                setCode(data.code);
            }
        } catch (err) {
            console.error('Failed to generate Telegram link code:', err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!code) return;
        navigator.clipboard.writeText(`/link ${code}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (code) {
        return (
            <div className="space-y-3">
                <div
                    onClick={copyToClipboard}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group relative overflow-hidden"
                >
                    <div className="flex items-center justify-between">
                        <code className="text-[10px] font-mono text-slate-600 block">/link {code}</code>
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400 group-hover:text-slate-600" />}
                    </div>
                </div>
                <p className="text-[10px] text-slate-400">
                    Copy and send this command to <a href="https://t.me/scriber_bot" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">@scriber_bot <ExternalLink size={10} /></a>
                </p>
            </div>
        );
    }

    return (
        <button
            onClick={generateCode}
            disabled={loading}
            className="w-full bg-blue-500 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
        >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Link Telegram
        </button>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const { meetings, loading } = useMeetings();
    const router = useRouter();

    const firstName = user?.name?.split(' ')[0] || 'User';

    // Calculate stats details
    const totalMinutes = meetings.reduce((acc: number, m: Meeting) => {
        if (!m.duration) return acc;
        let seconds = 0;
        if (typeof m.duration === 'number') {
            seconds = m.duration;
        } else if (typeof m.duration === 'string') {
            const parts = m.duration.split(':');
            if (parts.length === 2) {
                seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            }
        }
        return acc + seconds;
    }, 0) / 60;

    const displayMinutes = Math.round(totalMinutes);
    const monthlyLimit = 60;
    const usagePercentage = Math.min(100, (displayMinutes / monthlyLimit) * 100);

    // Sort meetings by date (newest first)
    const recentMeetings = [...meetings].sort((a: Meeting, b: Meeting) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    };

    const formatDuration = (val: string | number | undefined) => {
        if (!val) return '00:00';
        if (typeof val === 'string') return val;
        const m = Math.floor(val / 60);
        const s = Math.floor(val % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Status badge helper
    const getStatusBadge = (status: string) => {
        const isProcessing = ['PROCESSING', 'UPLOADED', 'UPLOADING', 'PROCESSING_TRANSCRIPT', 'PROCESSING_MINUTES'].includes(status);
        const isFailed = status === 'FAILED';
        const isComplete = status === 'COMPLETED';

        if (isProcessing) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Processing</span>;
        if (isFailed) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Failed</span>;
        if (isComplete) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Ready</span>;
        return null;
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-900 pb-32 lg:pb-12 relative selection:bg-violet-200 overflow-x-hidden">

            {/* Header Background - Gradient with Depth */}
            <div className="absolute top-0 left-0 right-0 h-[520px] md:h-[320px] lg:h-[260px] bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] z-0">
                {/* Abstract Shapes for Texture - Animated */}
                <div
                    className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-orange-500/8 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse">
                </div>
                <div
                    className="absolute bottom-0 left-0 w-48 h-48 md:w-72 md:h-72 bg-violet-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }}>
                </div>
                <div
                    className="absolute top-1/2 left-1/2 w-32 h-32 md:w-48 md:h-48 bg-indigo-400/5 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2">
                </div>
            </div>

            {/* Header Content */}
            <header
                className="px-6 md:px-12 pt-14 pb-2 flex items-center justify-between relative z-20 max-w-7xl mx-auto w-full">
                <div>
                    <p className="text-violet-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5">Welcome Back</p>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{firstName}.</h1>
                </div>

                {/* Desktop Navigation Links */}
                <Navbar />

                <div className="flex items-center gap-4">
                    <button
                        className="hidden md:flex w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl items-center justify-center border border-white/10 hover:bg-white/20 transition-colors text-white"
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
                    </button>
                    <Link href="/settings"
                        className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors cursor-pointer group"
                        aria-label="Settings"
                    >
                        <div
                            className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-500 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                            {user?.name?.[0] || 'U'}
                        </div>
                    </Link>
                </div>
            </header>

            {/* Main Layout - Desktop: Sidebar + Content */}
            <div className="px-6 md:px-12 relative z-10 max-w-7xl mx-auto w-full mt-6 lg:mt-8">
                <div className="lg:flex lg:gap-8">

                    {/* Left Sidebar - Desktop Only */}
                    <aside className="hidden lg:block lg:w-72 lg:shrink-0 space-y-6">

                        {/* Usage Stats Card */}
                        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-gradient-to-r from-orange-500/20 to-violet-500/20 text-violet-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-violet-200">
                                    Monthly Usage
                                </span>
                            </div>

                            <div className="flex items-center gap-5 mb-4">
                                <div className="hover:scale-105 transition-transform duration-300">
                                    <CircularProgress percentage={usagePercentage} color="#FF8F50" size={80} strokeWidth={7}>
                                        <span className="text-xl font-bold text-slate-800">{displayMinutes}<span className="text-xs font-normal text-slate-400">m</span></span>
                                    </CircularProgress>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        <span className="font-semibold text-orange-500">{displayMinutes}</span> of {monthlyLimit} min used
                                    </p>
                                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                                            style={{ width: `${usagePercentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">Quick Actions</h3>

                            <Link href="/record"
                                className="flex items-center gap-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-orange-100 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 group">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                                    <Mic size={22} />
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-slate-800">New Recording</span>
                                    <span className="block text-xs text-slate-400">Start live capture</span>
                                </div>
                                <ArrowUpRight size={16} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                            </Link>

                            <Link href="/upload"
                                className="flex items-center gap-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-violet-100 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 group">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform">
                                    <Upload size={22} />
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-slate-800">Upload File</span>
                                    <span className="block text-xs text-slate-400">Import audio/video</span>
                                </div>
                                <ArrowUpRight size={16} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
                            </Link>
                        </div>

                        {/* Upgrade CTA Card */}
                        <div className="bg-gradient-to-br from-violet-600 to-orange-500 rounded-2xl p-5 text-white shadow-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider opacity-90">Upgrade to Pro</span>
                            </div>
                            <p className="text-sm opacity-90 mb-4">Unlimited recordings, priority processing, and advanced AI features.</p>
                            <button className="w-full bg-white text-violet-700 font-bold text-sm py-2.5 rounded-xl hover:bg-violet-50 transition-colors">
                                Learn More
                            </button>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 min-w-0">

                        {/* Mobile-only: Hero Grid - Stats and Actions */}
                        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-8 items-center">
                            {/* Stats Section */}
                            <div className="flex items-center gap-6">
                                <div className="shrink-0 hover:scale-105 transition-transform duration-300">
                                    <CircularProgress percentage={usagePercentage} color="#FF8F50" size={100} strokeWidth={8}>
                                        <span className="text-2xl font-bold">{displayMinutes}<span className="text-sm font-normal text-indigo-200">m</span></span>
                                    </CircularProgress>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-gradient-to-r from-orange-500/20 to-violet-500/20 text-violet-200 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-violet-400/20 backdrop-blur-sm">Monthly Goal</span>
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-1.5">Recording Usage</h2>
                                    <p className="text-violet-200/70 text-xs md:text-sm font-medium leading-relaxed max-w-md">
                                        You&apos;ve used <span className="text-orange-300 font-semibold">{displayMinutes} minutes</span> of your {monthlyLimit} minute limit.
                                    </p>
                                </div>
                            </div>

                            {/* Quick Actions - Mobile */}
                            <div className="flex gap-4">
                                <Link href="/record"
                                    className="flex-1 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl shadow-orange-500/10 border border-orange-200/50 flex md:flex-col items-center md:items-start gap-3 md:gap-4 hover:scale-[1.03] hover:shadow-2xl hover:shadow-orange-500/20 hover:border-orange-300/60 transition-all duration-300 group h-full min-h-[100px]">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500 flex items-center justify-center group-hover:from-orange-500 group-hover:to-orange-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                        <Mic size={20} className="md:w-6 md:h-6" />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm md:text-base font-bold text-slate-800 group-hover:text-orange-600 transition-colors">Record</span>
                                        <span className="block text-[10px] md:text-xs text-slate-400 font-medium">New meeting</span>
                                    </div>
                                </Link>
                                <Link href="/upload"
                                    className="flex-1 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl shadow-violet-500/10 border border-violet-200/50 flex md:flex-col items-center md:items-start gap-3 md:gap-4 hover:scale-[1.03] hover:shadow-2xl hover:shadow-violet-500/20 hover:border-violet-300/60 transition-all duration-300 group h-full min-h-[100px]">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-500 flex items-center justify-center group-hover:from-violet-500 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                        <Upload size={20} className="md:w-6 md:h-6" />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm md:text-base font-bold text-slate-800 group-hover:text-violet-600 transition-colors">Upload</span>
                                        <span className="block text-[10px] md:text-xs text-slate-400 font-medium">Import file</span>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Content Section Header */}
                        <div className="mb-6 flex items-end justify-between">
                            <div>
                                <h3 className="text-lg md:text-xl font-bold text-white">Recent Activity</h3>
                                <p className="text-sm text-violet-200/70 lg:text-slate-400 mt-0.5 hidden sm:block">
                                    {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} total
                                </p>
                            </div>
                            <Link href="/meetings"
                                className="text-slate-400 hover:text-violet-600 text-xs md:text-sm font-bold transition-colors flex items-center gap-1 group">
                                See All
                                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>

                        {/* Meeting Cards - Desktop: List View, Mobile: Grid */}
                        <div className="space-y-3 lg:space-y-4">
                            {/* Skeleton Loading State */}
                            {loading && (
                                <>
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="bg-white py-4 px-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 animate-pulse">
                                            <div className="w-11 h-11 rounded-xl bg-slate-200" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-slate-200 rounded w-2/3" />
                                                <div className="h-3 bg-slate-100 rounded w-1/3" />
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-slate-100" />
                                        </div>
                                    ))}
                                </>
                            )}

                            {!loading && recentMeetings.slice(0, 8).map((meeting, i) => {
                                const isProcessing = ['PROCESSING', 'UPLOADED', 'UPLOADING', 'PROCESSING_TRANSCRIPT', 'PROCESSING_MINUTES'].includes(meeting.status);
                                const isRecorded = (meeting as Meeting & { originalFileName?: string }).originalFileName?.startsWith('recording_');
                                const isFailed = meeting.status === 'FAILED';

                                const getIcon = () => {
                                    if (isProcessing) return <Loader2 size={20} className="animate-spin" />;
                                    if (isFailed) return <AlertCircle size={20} />;
                                    if (isRecorded) return <Mic size={20} />;
                                    return <Upload size={20} />;
                                };

                                const getIconStyles = () => {
                                    if (isProcessing) return 'bg-amber-100 text-amber-600';
                                    if (isFailed) return 'bg-red-100 text-red-600';
                                    if (isRecorded) return 'bg-orange-100 text-orange-600';
                                    return 'bg-violet-100 text-violet-600';
                                };

                                return (
                                    <div key={meeting.id}
                                        onClick={() => router.push(`/meetings/${meeting.id}`)}
                                        style={{ animationDelay: `${i * 50}ms` }}
                                        className="bg-white py-4 px-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-xl hover:-translate-y-1 hover:border-violet-200 transition-all duration-300 cursor-pointer animate-fade-in-up">

                                        {/* Source Icon */}
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${getIconStyles()}`}>
                                            {getIcon()}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-slate-800 truncate text-sm lg:text-base group-hover:text-slate-900 transition-colors">
                                                    {meeting.title}
                                                </h4>
                                                {getStatusBadge(meeting.status)}
                                            </div>
                                            <p className="text-xs lg:text-sm text-slate-400 font-medium flex items-center gap-3">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={12} />
                                                    {formatDate(meeting.createdAt)}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    {formatDuration(meeting.duration)}
                                                </span>
                                            </p>
                                        </div>

                                        {/* Play Button */}
                                        <button
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-orange-600 group-hover:shadow-lg group-hover:shadow-orange-500/20 transition-all duration-300"
                                            aria-label="Play recording"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Play size={18} fill="currentColor" />
                                        </button>
                                    </div>
                                );
                            })}

                            {!loading && recentMeetings.length === 0 && (
                                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                                        <Mic size={28} className="text-slate-300" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-slate-700 mb-2">No meetings yet</h4>
                                    <p className="text-slate-400 text-sm mb-6">Start recording or upload an audio file to get started</p>
                                    <div className="flex justify-center gap-3">
                                        <Link href="/record" className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all">
                                            Record Now
                                        </Link>
                                        <Link href="/upload" className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-all">
                                            Upload File
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
