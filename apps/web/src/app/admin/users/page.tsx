'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    User as UserIcon,
    Ban,
    CheckCircle,
    Eye,
    Loader2,
} from 'lucide-react';

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
    _count: { meetings: number };
    subscription: {
        plan: { id: string; name: string };
    } | null;
}

interface Plan {
    id: string;
    name: string;
}

interface UserUsageStats {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        isActive: boolean;
        createdAt: string;
    };
    subscription: {
        plan: { name: string; maxMinutesPerUpload: number; maxUploadsPerWeek: number };
    } | null;
    stats: {
        totalMeetings: number;
        totalMinutes: number;
    };
    weeklyUsage: Array<{
        weekStartDate: string;
        uploadCount: number;
        minutesProcessed: number;
    }>;
}

export default function AdminUsersPage() {
    const { token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [total, setTotal] = useState(0);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // User detail modal
    const [selectedUser, setSelectedUser] = useState<UserUsageStats | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [loadingUser, setLoadingUser] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        if (token) {
            fetchUsers();
            fetchPlans();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, page, debouncedSearch]);

    const fetchUsers = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '20');
            if (debouncedSearch) params.set('search', debouncedSearch);

            const res = await fetch(
                `${apiEndpoint('/admin/users')}?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
                setPageCount(data.pageCount || 1);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    }, [token, page, debouncedSearch]);

    const fetchPlans = async () => {
        try {
            const res = await fetch(apiEndpoint('/admin/plans'), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setPlans(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch plans', error);
        }
    };

    const toggleStatus = async (userId: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`${apiEndpoint('/admin/users')}/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ active: !currentStatus }),
            });

            if (res.ok) {
                setUsers(
                    users.map((u) =>
                        u.id === userId ? { ...u, isActive: !currentStatus } : u
                    )
                );
            }
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    const updateUserPlan = async (userId: string, planId: string) => {
        try {
            const res = await fetch(`${apiEndpoint('/admin/users')}/${userId}/plan`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ planId }),
            });

            if (res.ok) {
                const updated = await res.json();
                setUsers(
                    users.map((u) =>
                        u.id === userId ? { ...u, subscription: updated } : u
                    )
                );
            }
        } catch (error) {
            console.error('Failed to update plan', error);
        }
    };

    const viewUserDetails = async (userId: string) => {
        setLoadingUser(true);
        setShowUserModal(true);
        try {
            const res = await fetch(`${apiEndpoint('/admin/users')}/${userId}/usage`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setSelectedUser(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch user details', error);
        } finally {
            setLoadingUser(false);
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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-text-main">User Management</h1>
                    <p className="text-text-muted mt-1">
                        Manage user accounts, plans, and access
                    </p>
                </div>
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                        size={16}
                    />
                    <Input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                    />
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-surface-hover border-b border-border">
                            <tr>
                                <th className="p-4 font-medium text-text-secondary">User</th>
                                <th className="p-4 font-medium text-text-secondary">Role</th>
                                <th className="p-4 font-medium text-text-secondary">Plan</th>
                                <th className="p-4 font-medium text-text-secondary">Meetings</th>
                                <th className="p-4 font-medium text-text-secondary">Status</th>
                                <th className="p-4 font-medium text-text-secondary">Joined</th>
                                <th className="p-4 font-medium text-text-secondary text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                                                <UserIcon size={16} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-text-main">
                                                    {u.name || u.email}
                                                </div>
                                                <div className="text-xs text-text-muted">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.role === 'ADMIN'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-gray-100 text-gray-700'
                                                }`}
                                        >
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={u.subscription?.plan?.id || ''}
                                            onChange={(e) => updateUserPlan(u.id, e.target.value)}
                                            className="text-sm bg-transparent border border-border rounded-lg px-2 py-1 hover:border-purple-300 focus:outline-none focus:border-purple-500"
                                            disabled={u.role === 'ADMIN'}
                                            title="Select subscription plan"
                                        >
                                            <option value="">No Plan</option>
                                            {plans.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4 text-text-main">{u._count.meetings}</td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {u.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-text-muted text-sm">
                                        {new Date(u.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => viewUserDetails(u.id)}
                                                title="View Details"
                                                className="text-text-muted hover:text-purple-600"
                                            >
                                                <Eye size={16} />
                                            </Button>
                                            {u.role !== 'ADMIN' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleStatus(u.id, u.isActive)}
                                                    title={u.isActive ? 'Disable User' : 'Enable User'}
                                                    className={
                                                        u.isActive
                                                            ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
                                                            : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                                                    }
                                                >
                                                    {u.isActive ? <Ban size={16} /> : <CheckCircle size={16} />}
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-border bg-surface-hover/50">
                    <p className="text-sm text-text-muted">
                        Showing {users.length} of {total} users
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
                        <span className="text-sm text-text-main px-2">
                            Page {page} of {pageCount}
                        </span>
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
            </div>

            {/* User Detail Modal */}
            <Modal
                isOpen={showUserModal}
                onClose={() => {
                    setShowUserModal(false);
                    setSelectedUser(null);
                }}
                title="User Details"
            >
                {loadingUser ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin h-6 w-6 text-purple-600" />
                    </div>
                ) : selectedUser ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-lg font-bold">
                                {selectedUser.user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-semibold text-text-main">
                                    {selectedUser.user.name || selectedUser.user.email}
                                </h3>
                                <p className="text-sm text-text-muted">{selectedUser.user.email}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface-hover rounded-lg p-3">
                                <p className="text-sm text-text-muted">Total Meetings</p>
                                <p className="text-xl font-bold text-text-main">
                                    {selectedUser.stats.totalMeetings}
                                </p>
                            </div>
                            <div className="bg-surface-hover rounded-lg p-3">
                                <p className="text-sm text-text-muted">Total Minutes</p>
                                <p className="text-xl font-bold text-text-main">
                                    {selectedUser.stats.totalMinutes}
                                </p>
                            </div>
                        </div>

                        {selectedUser.subscription && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <h4 className="font-medium text-purple-800 mb-2">Current Plan</h4>
                                <p className="text-purple-700">
                                    {selectedUser.subscription.plan.name}
                                </p>
                                <p className="text-sm text-purple-600 mt-1">
                                    {selectedUser.subscription.plan.maxMinutesPerUpload} min/upload •{' '}
                                    {selectedUser.subscription.plan.maxUploadsPerWeek} uploads/week
                                </p>
                            </div>
                        )}

                        {selectedUser.weeklyUsage.length > 0 && (
                            <div>
                                <h4 className="font-medium text-text-main mb-3">Recent Usage</h4>
                                <div className="space-y-2">
                                    {selectedUser.weeklyUsage.slice(0, 4).map((week, i) => (
                                        <div
                                            key={i}
                                            className="flex justify-between items-center text-sm p-2 bg-surface-hover rounded"
                                        >
                                            <span className="text-text-muted">
                                                Week of {new Date(week.weekStartDate).toLocaleDateString()}
                                            </span>
                                            <span className="text-text-main">
                                                {week.uploadCount} uploads • {week.minutesProcessed} min
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
