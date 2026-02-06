import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { FileAudio, Upload, Mic } from 'lucide-react';

interface EmptyStateProps {
    title?: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    secondaryActionLabel?: string;
    secondaryActionHref?: string;
}

export function EmptyState({
    title = "No meetings found",
    description = "Get started by uploading your first recording.",
    actionLabel = "Upload Recording",
    actionHref = "/dashboard",
    secondaryActionLabel,
    secondaryActionHref
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-surface/50">
            <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mb-6">
                <FileAudio size={32} className="text-primary" />
            </div>

            <h3 className="text-xl font-bold text-text-main mb-2">
                {title}
            </h3>

            <p className="text-text-muted max-w-sm mb-8">
                {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {secondaryActionLabel && secondaryActionHref && (
                    <Link href={secondaryActionHref} className="w-full sm:w-auto">
                        <Button variant="secondary" size="lg" className="w-full">
                            <Mic size={18} className="mr-2" />
                            {secondaryActionLabel}
                        </Button>
                    </Link>
                )}
                <Link href={actionHref} className="w-full sm:w-auto">
                    <Button size="lg" className="w-full shadow-lg shadow-primary/20">
                        <Upload size={18} className="mr-2" />
                        {actionLabel}
                    </Button>
                </Link>
            </div>
        </div>
    );
}
