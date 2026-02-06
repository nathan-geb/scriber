import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint, API_ENDPOINTS } from '@echomint/core';
import { Progress } from '@/components/ui/Progress';
import { AlertTriangle, Crown, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface UsageData {
    minutesUsed: number;
    minutesLimit: number;
    uploadsUsed: number;
    uploadsLimit: number;
    remainingMinutes: number;
    remainingUploads: number;
    monthlyMinutesLimit: number;
    maxUploadsPerWeek: number;
    minutesThisWeek: number;
    uploadsThisWeek: number;
}

export function UsageWidget() {
    const { token } = useAuth();
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            fetchUsage();
        }
    }, [token]);

    const fetchUsage = useCallback(async () => {
        try {
            const res = await fetch(apiEndpoint(API_ENDPOINTS.USERS_USAGE), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Map backend response to UsageData if needed, or just use raw if matching
                // Backend returns: { ..., remainingUploads, remainingMinutes, maxUploadsPerWeek, monthlyMinutesLimit, etc. }
                setUsage({
                    minutesUsed: data.minutesThisWeek,
                    minutesLimit: data.monthlyMinutesLimit,
                    uploadsUsed: data.uploadsThisWeek,
                    uploadsLimit: data.maxUploadsPerWeek,
                    remainingMinutes: data.remainingMinutes,
                    remainingUploads: data.remainingUploads,
                    monthlyMinutesLimit: data.monthlyMinutesLimit,
                    maxUploadsPerWeek: data.maxUploadsPerWeek,
                    minutesThisWeek: data.minutesThisWeek,
                    uploadsThisWeek: data.uploadsThisWeek
                });
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    if (loading || !usage) return null;

    // Check if user has unlimited access (admin)
    const isUnlimited = !isFinite(usage.minutesLimit) || !isFinite(usage.uploadsLimit);

    // If unlimited, show a simplified admin view
    if (isUnlimited) {
        return (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-text-main flex items-center gap-2">
                        Usage & Limits
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
                        <Infinity size={12} />
                        Admin
                    </span>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-lg border border-emerald-500/20">
                        <div>
                            <p className="font-semibold text-text-main">Unlimited Access</p>
                            <p className="text-sm text-text-secondary">No upload or minute restrictions</p>
                        </div>
                        <Infinity size={32} className="text-emerald-500" />
                    </div>
                </div>
            </div>
        );
    }

    const minutesPercent = (usage.minutesUsed / usage.minutesLimit) * 100;
    const uploadsPercent = (usage.uploadsUsed / usage.uploadsLimit) * 100;
    const isNearLimit = minutesPercent > 80 || uploadsPercent > 80;

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-main flex items-center gap-2">
                    Usage & Limits
                </h3>
                {isNearLimit && (
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-full">
                        <AlertTriangle size={12} />
                        Near Limit
                    </span>
                )}
            </div>

            <div className="space-y-6">
                {/* Minutes Usage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Monthly Minutes</span>
                        <span className="font-medium text-text-main">
                            {Math.round(usage.minutesUsed)} / {usage.minutesLimit} min
                        </span>
                    </div>
                    <Progress value={minutesPercent} className={minutesPercent > 90 ? 'bg-red-500' : 'bg-primary'} />
                </div>

                {/* Uploads Usage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Weekly Uploads</span>
                        <span className="font-medium text-text-main">
                            {usage.uploadsUsed} / {usage.uploadsLimit} uploads
                        </span>
                    </div>
                    <Progress value={uploadsPercent} className={uploadsPercent > 90 ? 'bg-red-500' : 'bg-primary'} />
                </div>

                {/* Upgrade Prompt */}
                {isNearLimit && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-full shrink-0">
                                <Crown size={16} className="text-primary" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm text-text-main mb-1">Upgrade to Pro</h4>
                                <p className="text-xs text-text-secondary mb-3">
                                    You&apos;re approaching your plan limits. Upgrade now for unlimited uploads and priority processing.
                                </p>
                                <Button size="sm" className="w-full">View Plans</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

