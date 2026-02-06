'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Circle } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'processing';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    /** Show dot indicator instead of icon */
    dot?: boolean;
    /** Show status icon */
    icon?: boolean;
    /** Custom className */
    className?: string;
    children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    processing: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    default: 'bg-gray-50 text-gray-700 border border-gray-200',
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
};

const iconSizes: Record<BadgeSize, number> = {
    sm: 10,
    md: 12,
    lg: 14,
};

function BadgeIcon({ variant, size }: { variant: BadgeVariant; size: BadgeSize }) {
    const iconSize = iconSizes[size];

    switch (variant) {
        case 'success':
            return <CheckCircle2 size={iconSize} />;
        case 'warning':
            return <AlertTriangle size={iconSize} />;
        case 'danger':
            return <XCircle size={iconSize} />;
        case 'processing':
            return <Loader2 size={iconSize} className="animate-spin" />;
        default:
            return <Circle size={iconSize} />;
    }
}

export function Badge({
    variant = 'default',
    size = 'sm',
    dot = false,
    icon = false,
    className = '',
    children
}: BadgeProps) {
    return (
        <span
            className={`
                inline-flex items-center justify-center font-semibold rounded-full
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${className}
            `}
        >
            {dot && (
                <span
                    className={`rounded-full bg-current ${size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-2.5 h-2.5'
                        }`}
                />
            )}
            {icon && !dot && <BadgeIcon variant={variant} size={size} />}
            {children}
        </span>
    );
}

// Status helper for meeting statuses
export type MeetingStatus =
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'PROCESSING_TRANSCRIPT'
    | 'PROCESSING_MINUTES'
    | 'UPLOADED'
    | 'UPLOADING';

export function getStatusVariant(status: string): BadgeVariant {
    switch (status) {
        case 'COMPLETED':
            return 'success';
        case 'FAILED':
            return 'danger';
        case 'CANCELLED':
            return 'default';
        case 'PROCESSING_TRANSCRIPT':
        case 'PROCESSING_MINUTES':
            return 'processing';
        case 'UPLOADED':
        case 'UPLOADING':
            return 'warning';
        default:
            return 'default';
    }
}

export function formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ');
}

// Convenience component for meeting status
interface StatusBadgeProps {
    status: string;
    size?: BadgeSize;
    className?: string;
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
    return (
        <Badge
            variant={getStatusVariant(status)}
            size={size}
            icon={status === 'PROCESSING_TRANSCRIPT' || status === 'PROCESSING_MINUTES'}
            className={className}
        >
            {formatStatusLabel(status)}
        </Badge>
    );
}
