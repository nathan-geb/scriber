'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FolderOpen,
    Mic,
    LayoutDashboard,
    Upload,
    User,
    Plus,
    X
} from 'lucide-react';

export function FloatingNav() {
    const pathname = usePathname();
    const [fabOpen, setFabOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard' || pathname === '/';
        }
        if (href === '/settings') {
            return pathname?.startsWith('/settings');
        }
        return pathname?.startsWith(href);
    };

    const toggleFab = () => setFabOpen(!fabOpen);
    const closeFab = () => setFabOpen(false);

    const fabActions = [
        { href: '/record', label: 'Record', icon: Mic, color: 'from-orange-500 to-red-500' },
        { href: '/upload', label: 'Upload', icon: Upload, color: 'from-indigo-500 to-purple-500' },
    ];

    return (
        <>
            {/* Backdrop when FAB is open */}
            {fabOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={closeFab}
                />
            )}

            <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
                {/* FAB Speed Dial Actions */}
                <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-300 ${fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                    }`}>
                    {fabActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.href}
                                href={action.href}
                                onClick={closeFab}
                                className={`flex items-center gap-3 bg-white pl-4 pr-5 py-3 rounded-full shadow-xl border border-slate-100 hover:scale-105 transition-all duration-200`}
                                style={{
                                    transitionDelay: fabOpen ? `${index * 50}ms` : '0ms',
                                    transform: fabOpen ? 'scale(1)' : 'scale(0.8)'
                                }}
                            >
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${action.color} flex items-center justify-center text-white shadow-lg`}>
                                    <Icon size={20} />
                                </div>
                                <span className="font-semibold text-slate-700">{action.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Main Navigation Bar */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shadow-black/30">
                    {/* Dashboard */}
                    <Link
                        href="/dashboard"
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${isActive('/dashboard')
                                ? 'text-white bg-white/15'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <LayoutDashboard size={22} strokeWidth={isActive('/dashboard') ? 2.5 : 2} />
                    </Link>

                    {/* Meetings */}
                    <Link
                        href="/meetings"
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${isActive('/meetings')
                                ? 'text-white bg-white/15'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FolderOpen size={22} strokeWidth={isActive('/meetings') ? 2.5 : 2} />
                    </Link>

                    {/* FAB Button */}
                    <button
                        onClick={toggleFab}
                        className={`w-14 h-14 -my-3 mx-1 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${fabOpen
                                ? 'bg-slate-700 rotate-45 scale-90'
                                : 'bg-gradient-to-tr from-indigo-500 to-violet-600 hover:scale-105 active:scale-95 shadow-indigo-500/40'
                            }`}
                        aria-label={fabOpen ? 'Close menu' : 'Create new'}
                    >
                        {fabOpen ? (
                            <X size={24} strokeWidth={2.5} />
                        ) : (
                            <Plus size={26} strokeWidth={2.5} />
                        )}
                    </button>

                    {/* Profile */}
                    <Link
                        href="/settings"
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${isActive('/settings')
                                ? 'text-white bg-white/15'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <User size={22} strokeWidth={isActive('/settings') ? 2.5 : 2} />
                    </Link>
                </div>
            </nav>
        </>
    );
}
