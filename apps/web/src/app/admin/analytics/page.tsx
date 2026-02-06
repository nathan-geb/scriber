'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { StatCard } from '@/components/admin/StatCard';
import {
    BarChart3,
    Activity,
    Clock,
    Loader2,
    TrendingUp,
} from 'lucide-react';

interface AnalyticsData {
    period: string;
    analytics: Array<{
        period: string;
        total: number;
        completed: number;
        failed: number;
        minutes: number;
        successRate: number;
    }>;
    topUsers: Array<{
        id: string;
        email: string;
        name: string | null;
        meetingCount: number;
        plan: string;
    }>;
}

export default function AdminAnalyticsPage() {
    const { token } = useAuth();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

    useEffect(() => {
        if (token) {
            fetchAnalytics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, period]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${apiEndpoint('/admin/analytics/meetings')}?period=${period}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (res.ok) {
                setAnalytics(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate summary stats
    const totalMeetings =
        analytics?.analytics.reduce((sum, a) => sum + a.total, 0) || 0;
    const totalMinutes =
        analytics?.analytics.reduce((sum, a) => sum + a.minutes, 0) || 0;
    const avgSuccessRate =
        analytics?.analytics.length
            ? Math.round(
                analytics.analytics.reduce((sum, a) => sum + a.successRate, 0) /
                analytics.analytics.length
            )
            : 0;

    if (loading && !analytics) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-text-main">Usage Analytics</h1>
                    <p className="text-text-muted mt-1">
                        Analyze meeting and transcription trends
                    </p>
                </div>

                {/* Period Selector */}
                <div className="flex rounded-lg overflow-hidden border border-border">
                    {(['day', 'week', 'month'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${period === p
                                ? 'bg-purple-600 text-white'
                                : 'bg-surface hover:bg-surface-hover text-text-muted'
                                }`}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}ly
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                    title={`Total Meetings (${period}ly)`}
                    value={totalMeetings}
                    icon={<BarChart3 size={24} />}
                    color="purple"
                />
                <StatCard
                    title="Minutes Processed"
                    value={totalMinutes.toLocaleString()}
                    icon={<Clock size={24} />}
                    color="blue"
                />
                <StatCard
                    title="Avg Success Rate"
                    value={`${avgSuccessRate}%`}
                    icon={<Activity size={24} />}
                    color="green"
                />
            </div>

            {/* Trends Chart (Table visualization) */}
            <div className="bg-surface border border-border rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-text-main mb-4">
                    {period.charAt(0).toUpperCase() + period.slice(1)}ly Trends
                </h2>

                {analytics?.analytics && analytics.analytics.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-border">
                                <tr>
                                    <th className="p-3 font-medium text-text-secondary">Period</th>
                                    <th className="p-3 font-medium text-text-secondary text-right">
                                        Total
                                    </th>
                                    <th className="p-3 font-medium text-text-secondary text-right">
                                        Completed
                                    </th>
                                    <th className="p-3 font-medium text-text-secondary text-right">
                                        Failed
                                    </th>
                                    <th className="p-3 font-medium text-text-secondary text-right">
                                        Minutes
                                    </th>
                                    <th className="p-3 font-medium text-text-secondary text-right">
                                        Success %
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {analytics.analytics.map((row) => (
                                    <tr key={row.period} className="hover:bg-surface-hover">
                                        <td className="p-3 font-medium text-text-main">
                                            {row.period}
                                        </td>
                                        <td className="p-3 text-right text-text-main">{row.total}</td>
                                        <td className="p-3 text-right text-green-600">
                                            {row.completed}
                                        </td>
                                        <td className="p-3 text-right text-red-600">{row.failed}</td>
                                        <td className="p-3 text-right text-text-main">
                                            {row.minutes.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.successRate >= 90
                                                    ? 'bg-green-100 text-green-700'
                                                    : row.successRate >= 70
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}
                                            >
                                                {row.successRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-text-muted py-8">
                        No data available for this period
                    </p>
                )}
            </div>

            {/* Top Users */}
            <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-purple-600" />
                    <h2 className="text-lg font-semibold text-text-main">Top Users</h2>
                </div>

                {analytics?.topUsers && analytics.topUsers.length > 0 ? (
                    <div className="divide-y divide-border">
                        {analytics.topUsers.map((user, index) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between py-3"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-bold">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-medium text-text-main">
                                            {user.name || user.email}
                                        </p>
                                        {user.name && (
                                            <p className="text-xs text-text-muted">{user.email}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface-hover text-text-muted">
                                        {user.plan}
                                    </span>
                                    <span className="font-semibold text-text-main">
                                        {user.meetingCount} meetings
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-text-muted py-8">
                        No user data available
                    </p>
                )}
            </div>
        </div>
    );
}
