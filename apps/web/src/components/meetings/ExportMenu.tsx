import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { apiEndpoint } from '@echomint/core';

interface ExportMenuProps {
    meetingId: string;
    token: string;
    onClose: () => void;
    inline?: boolean;
}

type ExportScope = 'minutes' | 'transcript' | 'both';

export function ExportMenu({ meetingId, token, onClose, inline = false }: ExportMenuProps) {
    const [scope, setScope] = useState<ExportScope>('both');

    const getExportUrl = (format: string) => {
        const baseUrl = apiEndpoint(`/exports/${meetingId}/${format}`);
        const params = new URLSearchParams();
        params.append('token', token || '');
        if (scope === 'minutes') params.append('include', 'minutes');
        if (scope === 'transcript') params.append('include', 'transcript');
        // 'both' is default, no include param needed (or we could send both)

        return `${baseUrl}?${params.toString()}`;
    };

    return (
        <div className={inline ? "w-full" : "bg-surface border border-border rounded-xl shadow-xl p-2 min-w-[240px] max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"}>
            {!inline && (
                <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border mb-2 sticky top-0 bg-surface z-10">
                    Export Meeting
                </div>
            )}

            {/* Scope Selection */}
            <div className="px-2 mb-3">
                <div className="flex bg-surface-hover p-1 rounded-lg border border-border">
                    <ScopeButton
                        active={scope === 'minutes'}
                        onClick={() => setScope('minutes')}
                        label="Summary"
                    />
                    <ScopeButton
                        active={scope === 'transcript'}
                        onClick={() => setScope('transcript')}
                        label="Transcript"
                    />
                    <ScopeButton
                        active={scope === 'both'}
                        onClick={() => setScope('both')}
                        label="Both"
                    />
                </div>
            </div>

            <ExportLink
                href={getExportUrl('pdf')}
                label="PDF File (.pdf)"
                color="text-red-400"
                onClose={onClose}
            />
            <ExportLink
                href={getExportUrl('docx')}
                label="Microsoft Word (.docx)"
                color="text-blue-400"
                onClose={onClose}
            />
            <ExportLink
                href={getExportUrl('markdown')}
                label="Markdown (.md)"
                color="text-emerald-400"
                onClose={onClose}
            />
            <ExportLink
                href={getExportUrl('text')}
                label="Plain Text (.txt)"
                color="text-gray-400"
                onClose={onClose}
            />

            <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide border-t border-b border-border my-1">
                Captions & Timing
            </div>

            <ExportLink
                href={`${apiEndpoint(`/exports/${meetingId}/srt`)}?token=${encodeURIComponent(token || '')}`}
                label="Subtitles (.srt)"
                color="text-purple-400"
                onClose={onClose}
            />
            <ExportLink
                href={`${apiEndpoint(`/exports/${meetingId}/vtt`)}?token=${encodeURIComponent(token || '')}`}
                label="WebVTT (.vtt)"
                color="text-cyan-400"
                onClose={onClose}
            />
        </div>
    );
}

function ScopeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${active
                ? 'bg-surface shadow-sm text-text-primary border border-border'
                : 'text-text-muted hover:text-text-secondary'
                }`}
        >
            {label}
        </button>
    );
}

function ExportLink({ href, label, color, onClose }: { href: string; label: string; color: string; onClose: () => void }) {
    return (
        <a
            href={href}
            download
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-sm font-medium text-text-secondary"
        >
            <FileText size={16} className={color} />
            {label}
        </a>
    );
}
