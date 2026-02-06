'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'ADMIN')) {
            router.push('/dashboard');
        }
    }, [isLoading, user, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
            </div>
        );
    }

    if (user?.role !== 'ADMIN') {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar />
            <main className="ml-64 min-h-screen">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
