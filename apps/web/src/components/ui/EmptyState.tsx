'use client';

import React, { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: string;
    primaryAction?: {
        label: string;
        onClick: () => void;
        icon?: ReactNode;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
        icon?: ReactNode;
    };
}

export function EmptyState({
    icon,
    title,
    description,
    primaryAction,
    secondaryAction,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            {/* Illustrated graphic container */}
            <div className="relative w-40 h-40 mb-8">
                {/* Background gradient circle */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-50 rounded-full" />

                {/* Icon container */}
                <div className="absolute inset-6 flex items-center justify-center text-primary-400">
                    {icon}
                </div>

                {/* Decorative elements */}
                <div className="absolute top-3 right-3 w-5 h-5 bg-accent/20 rounded-full animate-pulse" />
                <div className="absolute bottom-6 left-2 w-4 h-4 bg-success/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="absolute top-10 left-6 w-3 h-3 bg-warning/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Text content */}
            <h3 className="text-xl font-bold text-text-main mb-2 tracking-tight">
                {title}
            </h3>
            <p className="text-text-muted max-w-xs mb-8 leading-relaxed">
                {description}
            </p>

            {/* Actions */}
            {(primaryAction || secondaryAction) && (
                <div className="flex flex-wrap gap-3 justify-center">
                    {primaryAction && (
                        <Button onClick={primaryAction.onClick} variant="gradient">
                            {primaryAction.icon}
                            {primaryAction.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button onClick={secondaryAction.onClick} variant="outline">
                            {secondaryAction.icon}
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
