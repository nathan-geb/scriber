'use client';

import React, { useState } from 'react';
import { Search, X, ChevronUp, ChevronDown, Users } from 'lucide-react';

interface Speaker {
    id: string;
    name: string;
}

interface TranscriptSearchProps {
    speakers: Speaker[];
    selectedSpeakers: string[];
    onSpeakersChange: (speakerIds: string[]) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    matchCount: number;
    currentMatch: number;
    onNextMatch: () => void;
    onPrevMatch: () => void;
}

export function TranscriptSearch({
    speakers,
    selectedSpeakers,
    onSpeakersChange,
    searchQuery,
    onSearchChange,
    matchCount,
    currentMatch,
    onNextMatch,
    onPrevMatch,
}: TranscriptSearchProps) {
    const [showSpeakerFilter, setShowSpeakerFilter] = useState(false);

    const handleSpeakerToggle = (speakerId: string) => {
        if (selectedSpeakers.includes(speakerId)) {
            onSpeakersChange(selectedSpeakers.filter(id => id !== speakerId));
        } else {
            onSpeakersChange([...selectedSpeakers, speakerId]);
        }
    };

    const selectAllSpeakers = () => {
        onSpeakersChange(speakers.map(s => s.id));
    };

    const clearAllSpeakers = () => {
        onSpeakersChange([]);
    };

    return (
        <div className="flex items-center gap-2 p-2 bg-surface border-b border-border">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search transcript..."
                    className="w-full pl-9 pr-20 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-main placeholder:text-text-light"
                />
                {searchQuery && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-xs text-text-muted">
                            {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : '0 found'}
                        </span>
                        {matchCount > 0 && (
                            <>
                                <button
                                    onClick={onPrevMatch}
                                    className="p-0.5 text-text-muted hover:text-text-main transition-colors"
                                    title="Previous match"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    onClick={onNextMatch}
                                    className="p-0.5 text-text-muted hover:text-text-main transition-colors"
                                    title="Next match"
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => onSearchChange('')}
                            className="p-0.5 text-text-muted hover:text-text-main transition-colors"
                            title="Clear search"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Speaker Filter */}
            <div className="relative">
                <button
                    onClick={() => setShowSpeakerFilter(!showSpeakerFilter)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${selectedSpeakers.length > 0 && selectedSpeakers.length < speakers.length
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-background border-border text-text-muted hover:text-text-main hover:border-border-hover'
                        }`}
                >
                    <Users size={14} />
                    Speakers
                    {selectedSpeakers.length > 0 && selectedSpeakers.length < speakers.length && (
                        <span className="bg-primary text-white text-xs px-1.5 rounded-full">
                            {selectedSpeakers.length}
                        </span>
                    )}
                </button>

                {/* Speaker Filter Dropdown */}
                {showSpeakerFilter && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="p-2 border-b border-border flex justify-between items-center">
                            <span className="text-xs font-semibold text-text-muted uppercase">Filter by Speaker</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={selectAllSpeakers}
                                    className="text-xs text-primary hover:underline"
                                >
                                    All
                                </button>
                                <span className="text-text-light">|</span>
                                <button
                                    onClick={clearAllSpeakers}
                                    className="text-xs text-text-muted hover:text-text-main"
                                >
                                    None
                                </button>
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                            {speakers.map(speaker => (
                                <label
                                    key={speaker.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSpeakers.length === 0 || selectedSpeakers.includes(speaker.id)}
                                        onChange={() => handleSpeakerToggle(speaker.id)}
                                        className="rounded border-border text-primary focus:ring-primary/50"
                                    />
                                    <span className="text-sm text-text-main truncate">{speaker.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper function to highlight search matches in text
export function highlightSearchMatches(
    text: string,
    query: string,
    isCurrentMatch: boolean
): React.ReactNode {
    if (!query.trim()) {
        return text;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
        if (regex.test(part)) {
            return (
                <mark
                    key={index}
                    className={`px-0.5 rounded ${isCurrentMatch ? 'bg-yellow-400 text-black' : 'bg-yellow-200 text-yellow-900'
                        }`}
                >
                    {part}
                </mark>
            );
        }
        return part;
    });
}
