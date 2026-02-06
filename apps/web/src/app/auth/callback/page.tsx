'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    useEffect(() => {
        if (!searchParams) {
            router.push('/login?error=invalid_callback');
            return;
        }

        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refresh_token');
        const userStr = searchParams.get('user');

        if (token && refreshToken && userStr) {
            try {
                // Decode user object
                const user = JSON.parse(atob(userStr));

                // Login via context
                login(
                    {
                        access_token: token,
                        refresh_token: refreshToken,
                        expires_in: 15 * 60, // 15 mins default
                    },
                    user
                );

                // Redirect to dashboard
                // Small delay to ensure state updates
                setTimeout(() => {
                    router.push('/dashboard');
                }, 100);
            } catch (error) {
                console.error('Failed to parse auth data', error);
                router.push('/login?error=auth_failed');
            }
        } else {
            // If missing params, redirect to login
            router.push('/login?error=invalid_callback');
        }
    }, [searchParams, login, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
                <h2 className="text-xl font-semibold text-text-main">Authenticating...</h2>
                <p className="text-text-muted">Please wait while we log you in.</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CallbackContent />
        </Suspense>
    );
}
