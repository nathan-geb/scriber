'use client';

import React, { useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    HelpCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

interface QualityMetrics {
    qualityScore: number;
    inaudibleCount: number;
    avgSpeakerConfidence: number;
    wordCount: number;
    segmentCount: number;
    speakerCount: number;
    avgSegmentLength: number;
    grade: string;
    recommendations: string[];
    details: {
        inaudiblePenalty: number;
        confidenceScore: number;
        lengthScore: number;
        speakerScore: number;
    };
}

interface QualityBadgeProps {
    qualityScore?: number | null;
    inaudibleCount?: number;
    onRecalculate?: () => Promise<QualityMetrics>;
    detailed?: boolean;
}

function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
}

function getScoreIcon(score: number) {
    if (score >= 80) return <CheckCircle2 size={14} className="text-green-500" />;
    if (score >= 60) return <AlertTriangle size={14} className="text-yellow-500" />;
    return <HelpCircle size={14} className="text-red-500" />;
}

function getGradeColor(grade: string): string {
    switch (grade) {
        case 'A': return 'text-green-600 bg-green-100';
        case 'B': return 'text-blue-600 bg-blue-100';
        case 'C': return 'text-yellow-600 bg-yellow-100';
        case 'D': return 'text-orange-600 bg-orange-100';
        default: return 'text-red-600 bg-red-100';
    }
}

export function QualityBadge({
    qualityScore,
    inaudibleCount = 0,
    onRecalculate,
    detailed = false,
}: QualityBadgeProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const score = qualityScore ?? 0;
    const colorClass = getScoreColor(score);

    const handleRecalculate = async () => {
        if (!onRecalculate) return;

        setIsLoading(true);
        try {
            const newMetrics = await onRecalculate();
            setMetrics(newMetrics);
            setIsExpanded(true);
        } catch (error) {
            console.error('Failed to recalculate:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!detailed) {
        return (
            <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${colorClass}`}
                title={`Quality Score: ${score}% (${inaudibleCount} inaudible sections)`}
            >
                {getScoreIcon(score)}
                <span>{score}%</span>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between hover:bg-surface-hover transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Activity size={18} />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-semibold text-text-main">
                            Quality Score
                        </div>
                        <div className="text-xs text-text-muted">
                            {inaudibleCount} inaudible sections
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {score}%
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {isExpanded && (
                <div className="p-3 border-t border-border bg-background-secondary">
                    {metrics ? (
                        <>
                            {/* Grade */}
                            <div className="flex items-center justify-center mb-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${getGradeColor(metrics.grade)}`}>
                                    {metrics.grade}
                                </div>
                            </div>

                            {/* Score Breakdown */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">Clarity</span>
                                    <span className="font-medium">{Math.round(metrics.details.inaudiblePenalty)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full"
                                        style={{ width: `${metrics.details.inaudiblePenalty}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">Speaker Confidence</span>
                                    <span className="font-medium">{Math.round(metrics.details.confidenceScore)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"
                                        style={{ width: `${metrics.details.confidenceScore}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">Segment Quality</span>
                                    <span className="font-medium">{Math.round(metrics.details.lengthScore)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full"
                                        style={{ width: `${metrics.details.lengthScore}%` }}
                                    />
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                <div className="p-2 bg-surface rounded-lg">
                                    <div className="text-lg font-bold text-text-main">{metrics.wordCount}</div>
                                    <div className="text-xs text-text-muted">Words</div>
                                </div>
                                <div className="p-2 bg-surface rounded-lg">
                                    <div className="text-lg font-bold text-text-main">{metrics.segmentCount}</div>
                                    <div className="text-xs text-text-muted">Segments</div>
                                </div>
                                <div className="p-2 bg-surface rounded-lg">
                                    <div className="text-lg font-bold text-text-main">{metrics.speakerCount}</div>
                                    <div className="text-xs text-text-muted">Speakers</div>
                                </div>
                            </div>

                            {/* Recommendations */}
                            {metrics.recommendations.length > 0 && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="text-xs font-semibold text-amber-700 mb-1">Suggestions</div>
                                    <ul className="text-xs text-amber-600 space-y-1">
                                        {metrics.recommendations.map((rec, i) => (
                                            <li key={i}>• {rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-text-muted mb-3">
                                Calculate detailed quality metrics
                            </p>
                            <button
                                onClick={handleRecalculate}
                                disabled={isLoading || !onRecalculate}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                    <Activity size={14} />
                                )}
                                Analyze Quality
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
