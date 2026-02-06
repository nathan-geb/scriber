'use client';

import React from 'react';
import { Globe } from 'lucide-react';

// Language code to display name mapping
const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    am: 'Amharic',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    zh: 'Chinese',
    ar: 'Arabic',
    hi: 'Hindi',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
};

// Language code to flag/color mapping
const LANGUAGE_COLORS: Record<string, string> = {
    en: 'bg-blue-100 text-blue-700 border-blue-200',
    am: 'bg-green-100 text-green-700 border-green-200',
    es: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    fr: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    de: 'bg-gray-100 text-gray-700 border-gray-200',
    zh: 'bg-red-100 text-red-700 border-red-200',
    ar: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    hi: 'bg-orange-100 text-orange-700 border-orange-200',
    pt: 'bg-lime-100 text-lime-700 border-lime-200',
    ru: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    ja: 'bg-pink-100 text-pink-700 border-pink-200',
    ko: 'bg-violet-100 text-violet-700 border-violet-200',
};

interface LanguageFilterProps {
    languages: string[];
    selectedLanguages: string[];
    onSelectionChange: (languages: string[]) => void;
}

export function LanguageFilter({
    languages,
    selectedLanguages,
    onSelectionChange,
}: LanguageFilterProps) {
    if (languages.length <= 1) {
        return null; // Don't show filter if only one language
    }

    const toggleLanguage = (lang: string) => {
        if (selectedLanguages.includes(lang)) {
            onSelectionChange(selectedLanguages.filter(l => l !== lang));
        } else {
            onSelectionChange([...selectedLanguages, lang]);
        }
    };

    const selectAll = () => {
        onSelectionChange([...languages]);
    };

    const clearAll = () => {
        onSelectionChange([]);
    };

    return (
        <div className="flex items-center gap-2 p-2 bg-surface border border-border rounded-lg">
            <Globe size={14} className="text-text-muted flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5">
                {languages.map(lang => {
                    const isSelected = selectedLanguages.length === 0 || selectedLanguages.includes(lang);
                    const colorClass = LANGUAGE_COLORS[lang] || 'bg-gray-100 text-gray-700 border-gray-200';

                    return (
                        <button
                            key={lang}
                            onClick={() => toggleLanguage(lang)}
                            className={`
                                px-2 py-0.5 text-xs font-medium rounded-md border transition-all
                                ${isSelected
                                    ? colorClass
                                    : 'bg-gray-50 text-gray-400 border-gray-200 opacity-50'
                                }
                                hover:opacity-100
                            `}
                        >
                            {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
                        </button>
                    );
                })}
            </div>
            {selectedLanguages.length > 0 && selectedLanguages.length < languages.length && (
                <button
                    onClick={selectAll}
                    className="text-xs text-primary hover:underline ml-1"
                >
                    Show all
                </button>
            )}
            {selectedLanguages.length > 0 && (
                <button
                    onClick={clearAll}
                    className="text-xs text-text-muted hover:text-text-main ml-1"
                >
                    Clear
                </button>
            )}
        </div>
    );
}

// Helper to get language badge for a single segment
export function LanguageBadge({ language }: { language: string }) {
    const colorClass = LANGUAGE_COLORS[language] || 'bg-gray-100 text-gray-700';
    const name = LANGUAGE_NAMES[language] || language.toUpperCase();

    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${colorClass}`}>
            {name}
        </span>
    );
}

// Helper to get segmmnt language display
export function SegmentLanguages({ languages }: { languages: string[] }) {
    if (!languages || languages.length === 0) return null;

    return (
        <div className="flex gap-1 flex-wrap">
            {languages.map(lang => (
                <LanguageBadge key={lang} language={lang} />
            ))}
        </div>
    );
}

export { LANGUAGE_NAMES, LANGUAGE_COLORS };
