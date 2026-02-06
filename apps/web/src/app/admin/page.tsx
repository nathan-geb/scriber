'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { StatCard } from '@/components/admin/StatCard';
import {
    Users,
    FileAudio,
    Activity,
    DollarSign,
    TrendingUp,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface AdminStats {
    userCount: number;
    meetingCount: number;
    completedMeetings: number;
    failedMeetings: number;
    successRate: number;
    newUsersLast7Days: number;
    totalMinutesProcessed: number;
    subscriptionsByPlan: Array<{
        planId: string;
        planName: string;
        count: number;
    }>;
}

interface RevenueStats {
    stripeConfigured: boolean;
    mrr: number;
    totalRevenue: number;
    subscribersByPlan: Array<{
        planName: string;
        price: number;
        subscriberCount: number;
    }>;
}

export default function AdminOverviewPage() {
    const { token } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [revenue, setRevenue] = useState<RevenueStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    const fetchData = async () => {
        try {
            const [statsRes, revenueRes] = await Promise.all([
                fetch(apiEndpoint('/admin/stats'), {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(apiEndpoint('/admin/revenue'), {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
            if (revenueRes.ok) {
                setRevenue(await revenueRes.json());
            }
        } catch (error) {
            console.error('Failed to fetch admin data', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-text-main">Dashboard Overview</h1>
                <p className="text-text-muted mt-1">
                    Monitor your platform&apos;s performance at a glance
                </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Total Users"
                    value={stats?.userCount || 0}
                    icon={<Users size={24} />}
                    color="blue"
                    trend={
                        stats?.newUsersLast7Days
                            ? { value: stats.newUsersLast7Days, isPositive: true }
                            : undefined
                    }
                />
                <StatCard
                    title="Total Meetings"
                    value={stats?.meetingCount || 0}
                    icon={<FileAudio size={24} />}
                    color="purple"
                />
                <StatCard
                    title="Success Rate"
                    value={`${stats?.successRate || 0}%`}
                    icon={<Activity size={24} />}
                    color="green"
                />
                <StatCard
                    title="Minutes Processed"
                    value={(stats?.totalMinutesProcessed || 0).toLocaleString()}
                    icon={<Clock size={24} />}
                    color="orange"
                />
            </div>

            {/* Revenue Stats */}
            {revenue?.stripeConfigured && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <StatCard
                        title="Monthly Revenue (MRR)"
                        value={`$${revenue.mrr.toLocaleString()}`}
                        icon={<DollarSign size={24} />}
                        color="green"
                    />
                    <StatCard
                        title="Total Revenue"
                        value={`$${revenue.totalRevenue.toLocaleString()}`}
                        icon={<TrendingUp size={24} />}
                        color="blue"
                    />
                    <StatCard
                        title="Failed Jobs"
                        value={stats?.failedMeetings || 0}
                        icon={<AlertTriangle size={24} />}
                        color="red"
                    />
                </div>
            )}

            {/* Subscribers by Plan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-text-main mb-4">
                        Subscribers by Plan
                    </h2>
                    <div className="space-y-3">
                        {stats?.subscriptionsByPlan.map((plan) => (
                            <div
                                key={plan.planId}
                                className="flex items-center justify-between p-3 bg-surface-hover rounded-lg"
                            >
                                <span className="font-medium text-text-main">
                                    {plan.planName}
                                </span>
                                <span className="text-text-muted">
                                    {plan.count} subscriber{plan.count !== 1 && 's'}
                                </span>
                            </div>
                        ))}
                        {(!stats?.subscriptionsByPlan ||
                            stats.subscriptionsByPlan.length === 0) && (
                                <p className="text-text-muted text-center py-4">
                                    No subscriptions yet
                                </p>
                            )}
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-text-main mb-4">
                        Quick Stats
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-text-muted">New users (7 days)</span>
                            <span className="font-semibold text-text-main">
                                {stats?.newUsersLast7Days || 0}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-muted">Completed meetings</span>
                            <span className="font-semibold text-green-600">
                                {stats?.completedMeetings || 0}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-muted">Failed meetings</span>
                            <span className="font-semibold text-red-600">
                                {stats?.failedMeetings || 0}
                            </span>
                        </div>
                        {!revenue?.stripeConfigured && (
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    <strong>Note:</strong> Stripe is not configured. Payment data
                                    is unavailable.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
