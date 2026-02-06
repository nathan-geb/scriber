'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, Mic, Settings, Plus, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    isRecord?: boolean;
    isUpload?: boolean;
}

const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/meetings', label: 'All Meetings', icon: FolderOpen },
    { href: '/record', label: 'Record New', icon: Mic },
    { href: '/upload', label: 'Upload File', icon: Plus },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { logout, user } = useAuth();

    const isActive = (href: string) => {
        if (href === '/dashboard' && (pathname === '/dashboard' || pathname === '/')) return true;
        if (href !== '/dashboard' && pathname?.startsWith(href)) return true;
        return false;
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar backdrop-blur-2xl md:flex supports-[backdrop-filter]:bg-sidebar/60">
            {/* Logo Area */}
            <div className="flex h-16 items-center px-6 border-b border-border/40">
                <Link href="/dashboard" className="flex items-center gap-2.5 group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-primary group-hover:scale-105 transition-transform">
                        <Mic size={18} />
                    </div>
                    <span className="font-display text-xl font-bold tracking-tight text-text-main">Scriber</span>
                </Link>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                                    ${active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-main'
                                    }
                                `}
                            >
                                <Icon size={18} className={active ? 'text-primary' : 'text-text-muted'} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User Profile / Logout */}
            <div className="border-t border-border/40 p-4">
                <div className="mb-4 flex items-center gap-3 px-2">
                    <div className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-text-medium text-xs font-bold shadow-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold text-text-main">
                            {user?.name || 'User'}
                        </span>
                        <span className="truncate text-xs text-text-muted">
                            {user?.email}
                        </span>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface hover:text-red-600 hover:border hover:border-red-100 hover:shadow-sm transition-all"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
