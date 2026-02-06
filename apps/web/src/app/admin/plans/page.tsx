'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiEndpoint } from '@echomint/core';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Layers,
    Users,
    Clock,
    Upload,
} from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    maxMinutesPerUpload: number;
    maxUploadsPerWeek: number;
    monthlyMinutesLimit: number;
    price: string;
    currency: string;
    subscriberCount: number;
}

interface PlanFormData {
    name: string;
    maxMinutesPerUpload: number;
    maxUploadsPerWeek: number;
    monthlyMinutesLimit: number;
    price: number;
    currency: string;
}

const defaultFormData: PlanFormData = {
    name: '',
    maxMinutesPerUpload: 30,
    maxUploadsPerWeek: 10,
    monthlyMinutesLimit: 300,
    price: 0,
    currency: 'USD',
};

export default function AdminPlansPage() {
    const { token } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState<PlanFormData>(defaultFormData);

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

    useEffect(() => {
        if (token) {
            fetchPlans();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

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
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingPlan(null);
        setFormData(defaultFormData);
        setShowModal(true);
    };

    const openEditModal = (plan: Plan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            maxMinutesPerUpload: plan.maxMinutesPerUpload,
            maxUploadsPerWeek: plan.maxUploadsPerWeek,
            monthlyMinutesLimit: plan.monthlyMinutesLimit,
            price: parseFloat(plan.price),
            currency: plan.currency,
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const url = editingPlan
                ? `${apiEndpoint('/admin/plans')}/${editingPlan.id}`
                : apiEndpoint('/admin/plans');
            const method = editingPlan ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                await fetchPlans();
                setShowModal(false);
                setFormData(defaultFormData);
                setEditingPlan(null);
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to save plan');
            }
        } catch (error) {
            console.error('Failed to save plan', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!planToDelete) return;

        try {
            const res = await fetch(
                `${apiEndpoint('/admin/plans')}/${planToDelete.id}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (res.ok) {
                await fetchPlans();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to delete plan');
            }
        } catch (error) {
            console.error('Failed to delete plan', error);
        } finally {
            setShowDeleteConfirm(false);
            setPlanToDelete(null);
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
                    <h1 className="text-2xl font-bold text-text-main">Plan Management</h1>
                    <p className="text-text-muted mt-1">
                        Create and manage subscription plans
                    </p>
                </div>
                <Button onClick={openCreateModal}>
                    <Plus size={16} className="mr-2" />
                    Create Plan
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className="bg-surface border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                <Layers size={24} />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(plan)}
                                    className="p-2 text-text-muted hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Edit plan"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setPlanToDelete(plan);
                                        setShowDeleteConfirm(true);
                                    }}
                                    className="p-2 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete plan"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold text-text-main mb-1">
                            {plan.name}
                        </h3>
                        <p className="text-2xl font-bold text-purple-600 mb-4">
                            ${parseFloat(plan.price).toFixed(2)}
                            <span className="text-sm text-text-muted font-normal">/month</span>
                        </p>

                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 text-text-muted">
                                <Clock size={16} />
                                <span>{plan.maxMinutesPerUpload} min per upload</span>
                            </div>
                            <div className="flex items-center gap-3 text-text-muted">
                                <Upload size={16} />
                                <span>{plan.maxUploadsPerWeek} uploads/week</span>
                            </div>
                            <div className="flex items-center gap-3 text-text-muted">
                                <Clock size={16} />
                                <span>{plan.monthlyMinutesLimit} min/month limit</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm">
                            <Users size={14} className="text-text-muted" />
                            <span className="text-text-muted">
                                {plan.subscriberCount} subscriber
                                {plan.subscriberCount !== 1 && 's'}
                            </span>
                        </div>
                    </div>
                ))}

                {plans.length === 0 && (
                    <div className="col-span-full bg-surface border border-dashed border-border rounded-xl p-12 text-center">
                        <Layers className="mx-auto h-10 w-10 text-text-muted mb-4" />
                        <h3 className="text-lg font-semibold text-text-main mb-2">
                            No Plans Yet
                        </h3>
                        <p className="text-text-muted mb-4">
                            Create your first subscription plan to start monetizing.
                        </p>
                        <Button onClick={openCreateModal}>
                            <Plus size={16} className="mr-2" />
                            Create Plan
                        </Button>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPlan ? 'Edit Plan' : 'Create Plan'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">
                            Plan Name
                        </label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Pro, Business"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">
                                Price (per month)
                            </label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) =>
                                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                                }
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">
                                Currency
                            </label>
                            <Input
                                value={formData.currency}
                                onChange={(e) =>
                                    setFormData({ ...formData, currency: e.target.value.toUpperCase() })
                                }
                                placeholder="USD"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">
                            Max Minutes per Upload
                        </label>
                        <Input
                            type="number"
                            min="1"
                            value={formData.maxMinutesPerUpload}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    maxMinutesPerUpload: parseInt(e.target.value) || 1,
                                })
                            }
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">
                            Max Uploads per Week
                        </label>
                        <Input
                            type="number"
                            min="1"
                            value={formData.maxUploadsPerWeek}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    maxUploadsPerWeek: parseInt(e.target.value) || 1,
                                })
                            }
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">
                            Monthly Minutes Limit
                        </label>
                        <Input
                            type="number"
                            min="1"
                            value={formData.monthlyMinutesLimit}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    monthlyMinutesLimit: parseInt(e.target.value) || 1,
                                })
                            }
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button variant="outline" onClick={() => setShowModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={saving || !formData.name}>
                            {saving ? (
                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            ) : null}
                            {editingPlan ? 'Save Changes' : 'Create Plan'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Delete Plan"
            >
                <div className="space-y-4">
                    <p className="text-text-muted">
                        Are you sure you want to delete &quot;{planToDelete?.name}&quot;?
                        {planToDelete?.subscriberCount && planToDelete.subscriberCount > 0 && (
                            <span className="block mt-2 text-red-600">
                                This plan has {planToDelete.subscriberCount} active subscriber
                                {planToDelete.subscriberCount !== 1 && 's'}. You must migrate them
                                first.
                            </span>
                        )}
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={(planToDelete?.subscriberCount ?? 0) > 0}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
