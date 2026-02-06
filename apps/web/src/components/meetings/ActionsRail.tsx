import React, { useState } from 'react';
import { Share2, Trash2, MoreVertical, FileText, Music, Copy, Check } from 'lucide-react';

interface ActionsRailProps {
    onShare: () => void;
    onDownloadAudio: () => void;
    onDownloadTranscript: () => void;
    onDownloadJSON: () => void;
    onDelete: () => void;
    onCopy: () => void;
    copyType: 'transcript' | 'minutes' | null;
    isMobile?: boolean;
}

export function ActionsRail({
    onShare,
    onDownloadAudio,
    onDownloadTranscript,
    onDelete,
    onCopy,
    // copyType,
    isMobile = false
}: ActionsRailProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`fixed z - 40 transition - all duration - 300 ${isMobile
            ? 'bottom-6 right-6 flex flex-col-reverse items-end gap-3'
            : 'right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3'
            } `}>
            {/* Main Toggle Button (Mobile Only) */}
            <div className="md:hidden">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-center h-14 w-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-600 hover:shadow-xl transition-all duration-200 hover-lift"
                    title="Toggle Actions"
                >
                    <MoreVertical size={24} />
                </button>
            </div>

            {/* Actions Container - Always visible on Desktop, Toggled on Mobile */}
            <div className={`
                flex flex - col gap - 3 transition - all duration - 200
                ${isMobile
                    ? (isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none')
                    : 'opacity-100'
                }
`}>

                {/* Share Action */}
                <div className="group relative flex items-center">
                    {!isMobile && (
                        <span className="absolute right-full mr-2 px-2 py-1 bg-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Share Meeting
                        </span>
                    )}
                    <button
                        onClick={onShare}
                        className="bg-surface border border-border p-3 rounded-full shadow-sm hover:bg-surface-hover hover:border-primary/50 hover:text-primary transition-all hover-lift"
                        title="Share Meeting"
                    >
                        <Share2 size={20} />
                    </button>
                </div>

                {/* Copy Content */}
                <div className="group relative flex items-center">
                    {!isMobile && (
                        <span className="absolute right-full mr-2 px-2 py-1 bg-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Copy Content
                        </span>
                    )}
                    <button
                        onClick={handleCopy}
                        className="bg-surface border border-border p-3 rounded-full shadow-sm hover:bg-surface-hover hover:border-primary/50 hover:text-primary transition-all hover-lift"
                        title="Copy to Clipboard"
                    >
                        {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                    </button>
                </div>

                {/* Download Audio */}
                <div className="group relative flex items-center">
                    {!isMobile && (
                        <span className="absolute right-full mr-2 px-2 py-1 bg-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Download Audio
                        </span>
                    )}
                    <button
                        onClick={onDownloadAudio}
                        className="bg-surface border border-border p-3 rounded-full shadow-sm hover:bg-surface-hover hover:border-primary/50 hover:text-primary transition-all hover-lift"
                        title="Download Audio"
                    >
                        <Music size={20} />
                    </button>
                </div>

                {/* Download Text */}
                <div className="group relative flex items-center">
                    {!isMobile && (
                        <span className="absolute right-full mr-2 px-2 py-1 bg-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Download Text
                        </span>
                    )}
                    <button
                        onClick={onDownloadTranscript}
                        className="bg-surface border border-border p-3 rounded-full shadow-sm hover:bg-surface-hover hover:border-primary/50 hover:text-primary transition-all hover-lift"
                        title="Download Text"
                    >
                        <FileText size={20} />
                    </button>
                </div>

                {/* Delete Action (Danger) */}
                <div className="group relative flex items-center">
                    {!isMobile && (
                        <span className="absolute right-full mr-2 px-2 py-1 bg-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Delete Meeting
                        </span>
                    )}
                    <button
                        onClick={onDelete}
                        className="bg-surface border border-border p-3 rounded-full shadow-sm hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all hover-lift"
                        title="Delete Meeting"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
}
