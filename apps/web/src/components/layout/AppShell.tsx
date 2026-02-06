'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FloatingNav } from './FloatingNav';

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    // Don't show nav on auth pages or if not logged in
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');
    const isPublicPage = pathname?.startsWith('/share');
    const showNav = user && !isAuthPage && !isPublicPage;

    return (
        <div className="min-h-screen bg-background">
            {/* Main Content Area */}
            <main className="transition-all duration-200">
                {children}
            </main>

            {/* Floating Navigation - Mobile Only */}
            {/* We import FloatingNav dynamically or just use it here if extracted */}
            {showNav && <FloatingNav />}
        </div>
    );
}
