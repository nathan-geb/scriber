'use client';

import React from 'react';
import { X } from 'lucide-react';

interface Tag {
    id: string;
    name: string;
    color?: string;
}

interface TagChipProps {
    tag: Tag;
    size?: 'sm' | 'md';
    removable?: boolean;
    onRemove?: (tagId: string) => void;
    onClick?: (tagId: string) => void;
}

// Default colors for tags
const TAG_COLORS = [
    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
    { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
];

function getTagColors(tagId: string, customColor?: string) {
    if (customColor) {
        // Return custom color style if provided
        return {
            bg: 'bg-opacity-20',
            text: '',
            border: 'border-current border-opacity-30',
            style: { backgroundColor: `${customColor}20`, color: customColor },
        };
    }
    // Hash-based consistent color
    const index = tagId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TAG_COLORS.length;
    return { ...TAG_COLORS[index], style: {} };
}

export function TagChip({
    tag,
    size = 'sm',
    removable = false,
    onRemove,
    onClick,
}: TagChipProps) {
    const colors = getTagColors(tag.id, tag.color);
    const sizeClasses = size === 'sm'
        ? 'text-xs px-2 py-0.5 gap-1'
        : 'text-sm px-3 py-1 gap-1.5';

    return (
        <span
            className={`
                inline-flex items-center rounded-full font-medium border transition-colors
                ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}
                ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
            `}
            style={colors.style}
            onClick={() => onClick?.(tag.id)}
        >
            {tag.name}
            {removable && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.(tag.id);
                    }}
                    className="hover:bg-black/10 rounded-full p-0.5 -mr-1 transition-colors"
                    aria-label={`Remove ${tag.name} tag`}
                >
                    <X size={size === 'sm' ? 12 : 14} />
                </button>
            )}
        </span>
    );
}

interface TagListProps {
    tags: Array<{ tag: Tag } | Tag>;
    max?: number;
    size?: 'sm' | 'md';
    removable?: boolean;
    onRemove?: (tagId: string) => void;
    onTagClick?: (tagId: string) => void;
}

export function TagList({
    tags,
    max = 3,
    size = 'sm',
    removable = false,
    onRemove,
    onTagClick,
}: TagListProps) {
    // Normalize tags - they might come as { tag: Tag } or just Tag
    const normalizedTags = tags.map(t => 'tag' in t ? t.tag : t);
    const displayTags = normalizedTags.slice(0, max);
    const remaining = normalizedTags.length - max;

    if (normalizedTags.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1">
            {displayTags.map(tag => (
                <TagChip
                    key={tag.id}
                    tag={tag}
                    size={size}
                    removable={removable}
                    onRemove={onRemove}
                    onClick={onTagClick}
                />
            ))}
            {remaining > 0 && (
                <span className={`
                    inline-flex items-center rounded-full font-medium
                    bg-slate-100 dark:bg-slate-800 text-text-muted
                    ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}
                `}>
                    +{remaining}
                </span>
            )}
        </div>
    );
}
