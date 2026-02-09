'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-orange-500" />
        <p className="text-slate-400 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}
