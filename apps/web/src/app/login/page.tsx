'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileAudio, Mail, Lock, Mic, FileText, Sparkles } from 'lucide-react';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';

const features = [
    { icon: Mic, title: 'Live Recording', description: 'Capture meetings in real-time' },
    { icon: FileText, title: 'AI Transcription', description: 'Accurate speaker-labeled transcripts' },
    { icon: Sparkles, title: 'Smart Minutes', description: 'Auto-generated meeting summaries' },
];

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(apiEndpoint(API_ENDPOINTS.AUTH_LOGIN), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Login failed');
            }

            login(
                {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_in: data.expires_in,
                },
                data.user
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] p-12 flex-col justify-between relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-20 right-20 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-40 left-10 w-48 h-48 bg-violet-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                <div className="relative">
                    <h1 className="font-display text-4xl text-white mb-4 tracking-tight">Scriber</h1>
                    <p className="text-violet-300/80 text-lg max-w-md">
                        Transform your meetings into actionable insights with AI-powered transcription
                    </p>
                </div>

                <div className="relative space-y-6">
                    {features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                                <feature.icon className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">{feature.title}</p>
                                <p className="text-violet-300/70 text-sm">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="relative text-violet-400/60 text-sm">
                    © 2024 Scriber. All rights reserved.
                </p>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <FileAudio className="text-white" size={28} />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-text-main tracking-tight">Welcome back</h2>
                        <p className="text-text-muted mt-2">Sign in to your account to continue</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-danger-soft text-danger text-sm rounded-[14px] font-medium border border-danger/20 flex items-center gap-3">
                            <div className="w-6 h-6 bg-danger/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold">!</span>
                            </div>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="name@example.com"
                            icon={<Mail size={20} />}
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            icon={<Lock size={20} />}
                        />

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-4 h-4" />
                                <span className="text-text-secondary">Remember me</span>
                            </label>
                            <a href="#" className="text-violet-600 font-medium hover:text-violet-700 hover:underline transition-colors">Forgot password?</a>
                        </div>

                        <Button type="submit" variant="gradient" className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600" size="lg" isLoading={loading}>
                            Sign In
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-surface px-2 text-text-muted">Or continue with</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/google`}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-main hover:bg-surface-hover transition-colors"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26..81-.58z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Sign in with Google
                        </a>

                        <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/apple`}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-900 transition-colors"
                        >
                            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.45-1.02 4.12-.87 1.25.13 2.53.68 3.32 1.83-3.14 1.87-2.45 6.09.68 7.36-.66 1.69-1.63 3.37-3.2 3.91zM11.94 5.26c.72-1.02.94-2.58.6-3.76 1.43.14 2.89.86 3.36 2.12.56 1.48-.19 2.92-.72 3.65-.63.9-2.03 1.2-3.2.73-.24-1.12.18-2.6.04-2.74z" />
                            </svg>
                            Sign in with Apple
                        </a>
                    </div>

                    <p className="mt-8 text-center text-sm text-text-muted">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="font-medium text-violet-600 hover:text-violet-700 transition-colors">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
