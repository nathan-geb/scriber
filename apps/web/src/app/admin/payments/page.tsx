'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { StatCard } from '@/components/admin/StatCard';
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    Loader2,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    userEmail: string;
    userName: string | null;
    description: string | null;
    createdAt: string;
}

interface RevenueStats {
    stripeConfigured: boolean;
    mrr: number;
    totalRevenue: number;
    monthlyRevenue: Array<{ month: string; amount: number }>;
    subscribersByPlan: Array<{
        planName: string;
        price: number;
        subscriberCount: number;
    }>;
    error?: string;
}

interface PaymentHistoryResponse {
    payments: Payment[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
    stripeConfigured: boolean;
    error?: string;
}

export default function AdminPaymentsPage() {
    const { token } = useAuth();
    const [revenue, setRevenue] = useState<RevenueStats | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);

    useEffect(() => {
        if (token) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, page]);

    const fetchData = async () => {
        try {
            const [revenueRes, paymentsRes] = await Promise.all([
                fetch(apiEndpoint('/admin/revenue'), {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${apiEndpoint('/admin/payments')}?page=${page}&limit=15`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (revenueRes.ok) {
                setRevenue(await revenueRes.json());
            }

            if (paymentsRes.ok) {
                const data: PaymentHistoryResponse = await paymentsRes.json();
                setPayments(data.payments);
                setPageCount(data.pageCount);
            }
        } catch (error) {
            console.error('Failed to fetch payment data', error);
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

    if (!revenue?.stripeConfigured) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-text-main">Payments & Revenue</h1>
                    <p className="text-text-muted mt-1">View payment history and revenue analytics</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
                    <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                        Stripe Not Configured
                    </h2>
                    <p className="text-yellow-700 max-w-md mx-auto">
                        Payment tracking requires Stripe integration. Add your{' '}
                        <code className="bg-yellow-100 px-1 rounded">STRIPE_SECRET_KEY</code> to
                        the environment variables to enable this feature.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-text-main">Payments & Revenue</h1>
                <p className="text-text-muted mt-1">
                    View payment history and revenue analytics
                </p>
            </div>

            {/* Revenue Stats */}
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
                    title="Total Subscribers"
                    value={revenue.subscribersByPlan.reduce(
                        (sum, p) => sum + p.subscriberCount,
                        0
                    )}
                    icon={<CreditCard size={24} />}
                    color="purple"
                />
            </div>

            {/* Monthly Revenue Chart (Simple Table) */}
            {revenue.monthlyRevenue.length > 0 && (
                <div className="bg-surface border border-border rounded-xl p-6 mb-8">
                    <h2 className="text-lg font-semibold text-text-main mb-4">
                        Monthly Revenue
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {revenue.monthlyRevenue.slice(-6).map((m) => (
                            <div
                                key={m.month}
                                className="bg-surface-hover rounded-lg p-3 text-center"
                            >
                                <p className="text-xs text-text-muted">{m.month}</p>
                                <p className="text-lg font-bold text-green-600">
                                    ${m.amount.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Subscribers by Plan */}
            <div className="bg-surface border border-border rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-text-main mb-4">
                    Subscribers by Plan
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {revenue.subscribersByPlan.map((plan) => (
                        <div
                            key={plan.planName}
                            className="flex items-center justify-between p-4 bg-surface-hover rounded-lg"
                        >
                            <div>
                                <p className="font-medium text-text-main">{plan.planName}</p>
                                <p className="text-sm text-text-muted">
                                    ${plan.price}/month
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-bold text-purple-600">
                                    {plan.subscriberCount}
                                </p>
                                <p className="text-xs text-text-muted">subscribers</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment History */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-text-main">
                        Recent Payments
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-surface-hover border-b border-border">
                            <tr>
                                <th className="p-4 font-medium text-text-secondary">Date</th>
                                <th className="p-4 font-medium text-text-secondary">Customer</th>
                                <th className="p-4 font-medium text-text-secondary">Description</th>
                                <th className="p-4 font-medium text-text-secondary">Amount</th>
                                <th className="p-4 font-medium text-text-secondary">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {payments.map((payment) => (
                                <tr
                                    key={payment.id}
                                    className="hover:bg-surface-hover transition-colors"
                                >
                                    <td className="p-4 text-text-muted text-sm">
                                        {new Date(payment.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-text-main">
                                            {payment.userName || payment.userEmail}
                                        </div>
                                        {payment.userName && (
                                            <div className="text-xs text-text-muted">
                                                {payment.userEmail}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-text-muted">
                                        {payment.description || 'Subscription payment'}
                                    </td>
                                    <td className="p-4 font-semibold text-green-600">
                                        ${payment.amount.toFixed(2)} {payment.currency}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'succeeded'
                                                ? 'bg-green-100 text-green-700'
                                                : payment.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {payment.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-text-muted">
                                        No payments found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pageCount > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border bg-surface-hover/50">
                        <p className="text-sm text-text-muted">
                            Page {page} of {pageCount}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                disabled={page >= pageCount}
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
