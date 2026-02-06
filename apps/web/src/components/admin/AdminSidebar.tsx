'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    Layers,
    BarChart3,
    ArrowLeft,
    Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
}

const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard },
    { href: '/admin/plans', label: 'Plans', icon: Layers },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();

    const isActive = (href: string) => {
        if (href === '/admin' && pathname === '/admin') return true;
        if (href !== '/admin' && pathname?.startsWith(href)) return true;
        return false;
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 z-40 w-64 flex-col border-r border-border bg-sidebar backdrop-blur-2xl flex supports-[backdrop-filter]:bg-sidebar/60">
            {/* Logo Area */}
            <div className="flex h-16 items-center px-6 border-b border-border/40">
                <Link href="/admin" className="flex items-center gap-2.5 group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-lg group-hover:scale-105 transition-transform">
                        <Shield size={18} />
                    </div>
                    <span className="font-display text-xl font-bold tracking-tight text-text-main">
                        Admin Panel
                    </span>
                </Link>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <nav className="flex flex-col gap-1">
                    {adminNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${active
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-main'
                                    }
                `}
                            >
                                <Icon
                                    size={18}
                                    className={active ? 'text-purple-600' : 'text-text-muted'}
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Back to App */}
            <div className="border-t border-border/40 p-4">
                <div className="mb-4 flex items-center gap-3 px-2">
                    <div className="h-8 w-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 text-xs font-bold shadow-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold text-text-main">
                            {user?.name || 'Admin'}
                        </span>
                        <span className="truncate text-xs text-text-muted">
                            {user?.email}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface hover:text-primary hover:border hover:border-primary/20 hover:shadow-sm transition-all"
                >
                    <ArrowLeft size={16} />
                    Back to App
                </button>
            </div>
        </aside>
    );
}
