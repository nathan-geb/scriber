'use client';

import { LayoutDashboard, Folder, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path === '/meetings' && pathname?.startsWith('/meetings')) return true;
        if (path === '/settings' && pathname?.startsWith('/settings')) return true;
        return false;
    };

    return (
        <nav
            className="hidden md:flex items-center gap-8 text-indigo-100 font-medium text-sm bg-white/5 px-6 py-3 rounded-full backdrop-blur-sm border border-white/5">
            <Link href="/dashboard"
                className={`flex items-center gap-2 transition-colors ${isActive('/dashboard') ? 'text-white font-bold' : 'hover:text-white'}`}
            >
                <LayoutDashboard size={18} /> Dashboard
            </Link>
            <Link href="/meetings"
                className={`flex items-center gap-2 transition-colors ${isActive('/meetings') ? 'text-white font-bold' : 'hover:text-white'}`}
            >
                <Folder size={18} /> Files
            </Link>
            <Link href="/settings" className={`flex items-center gap-2 transition-colors ${isActive('/settings') ? 'text-white font-bold' : 'hover:text-white'}`}>
                <Settings size={18} /> Settings
            </Link>
        </nav>
    );
}
