import React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Calendar, Clock, ChevronRight } from 'lucide-react';
import type { Meeting } from '@echomint/core';
import { Button } from '@/components/ui/Button';

interface MeetingCardProps {
    meeting: Meeting;
    isSelected: boolean;
    onSelect: () => void;
    onDelete?: () => void;
}

export function MeetingCard({ meeting, isSelected, onSelect }: MeetingCardProps) {
    const router = useRouter();

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-success/10 text-success';
            case 'FAILED': return 'bg-danger/10 text-danger';
            case 'PROCESSING_TRANSCRIPT':
            case 'PROCESSING_MINUTES': return 'bg-warning/10 text-warning';
            default: return 'bg-primary/10 text-primary';
        }
    };

    return (
        <div
            onClick={() => router.push(`/meetings/${meeting.id}`)}
            className={`
                group relative bg-surface rounded-xl border p-4 transition-all duration-200 cursor-pointer
                hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5
                ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border'}
            `}
        >
            {/* Selection Checkbox */}
            <div
                className="absolute top-4 left-4 z-10"
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
            >
                <div className={`
                    w-5 h-5 rounded border transition-colors flex items-center justify-center
                    ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border group-hover:border-primary/50'}
                `}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
            </div>

            {/* Header / Icon */}
            <div className="flex items-start justify-between pl-8 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-primary">
                    <FileText size={20} />
                </div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(meeting.status)}`}>
                    {meeting.status.replace(/_/g, ' ')}
                </div>
            </div>

            {/* Content */}
            <div className="pl-2">
                <h3 className="font-bold text-text-main truncate mb-1">
                    {meeting.title || 'Untitled Meeting'}
                </h3>

                <div className="flex items-center gap-3 text-xs text-text-muted mb-4">
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(meeting.createdAt)}
                    </span>
                    {meeting.durationSeconds && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDuration(meeting.durationSeconds)}
                        </span>
                    )}
                </div>

                {/* Tags (optional) */}
                <div className="h-6 flex items-center mb-2">
                    {/* Placeholder for tags if needed */}
                </div>
            </div>

            {/* Footer / Quick Actions */}
            <div className="flex items-center justify-end mt-2 pt-3 border-t border-border/50">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-primary hover:bg-primary-light group-hover:opacity-100 opacity-0 transition-opacity"
                >
                    View Details
                    <ChevronRight size={14} className="ml-1" />
                </Button>
            </div>
        </div>
    );
}
