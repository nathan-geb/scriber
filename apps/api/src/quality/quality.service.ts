import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface QualityMetrics {
    qualityScore: number;
    inaudibleCount: number;
    avgSpeakerConfidence: number;
    wordCount: number;
    segmentCount: number;
    speakerCount: number;
    avgSegmentLength: number;
    details: {
        inaudiblePenalty: number;
        confidenceScore: number;
        lengthScore: number;
        speakerScore: number;
    };
}

@Injectable()
export class QualityService {
    constructor(private readonly prisma: PrismaService) { }

    async calculateQuality(meetingId: string): Promise<QualityMetrics> {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                transcript: true,
                speakers: true,
            },
        });

        if (!meeting || !meeting.transcript || meeting.transcript.length === 0) {
            return {
                qualityScore: 0,
                inaudibleCount: 0,
                avgSpeakerConfidence: 0,
                wordCount: 0,
                segmentCount: 0,
                speakerCount: 0,
                avgSegmentLength: 0,
                details: {
                    inaudiblePenalty: 0,
                    confidenceScore: 0,
                    lengthScore: 0,
                    speakerScore: 0,
                },
            };
        }

        // Calculate metrics
        const segments = meeting.transcript;
        const speakers = meeting.speakers;

        // Word and segment counts
        const wordCount = segments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
        const segmentCount = segments.length;
        const avgSegmentLength = wordCount / segmentCount;

        // Inaudible count
        const inaudiblePattern = /\[(inaudible|unclear)\]/gi;
        const inaudibleCount = segments.reduce((sum, s) => {
            const matches = s.text.match(inaudiblePattern);
            return sum + (matches ? matches.length : 0);
        }, 0);

        // Speaker confidence average
        const confidenceValues = speakers
            .filter(s => s.nameConfidence !== null && s.nameConfidence !== undefined)
            .map(s => s.nameConfidence!);
        const avgSpeakerConfidence = confidenceValues.length > 0
            ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
            : 0.5;

        // Calculate scores (0-100 scale)

        // Inaudible penalty: start at 100, lose 5 points per inaudible, min 0
        const inaudiblePenalty = Math.max(0, 100 - inaudibleCount * 5);

        // Confidence score: direct mapping from 0-1 to 0-100
        const confidenceScore = avgSpeakerConfidence * 100;

        // Length score: score higher for longer segments (more complete sentences)
        // Ideal is 15-30 words per segment
        const lengthScore = Math.min(100, (avgSegmentLength / 20) * 100);

        // Speaker score: bonus for having multiple identified speakers
        const speakerScore = Math.min(100, speakers.filter(s => !s.isUnknown).length * 25);

        // Weighted average
        const qualityScore = Math.round(
            inaudiblePenalty * 0.4 +  // 40% weight on clarity
            confidenceScore * 0.3 +  // 30% weight on speaker confidence
            lengthScore * 0.15 +     // 15% weight on segment quality
            speakerScore * 0.15      // 15% weight on speaker identification
        );

        return {
            qualityScore: Math.max(0, Math.min(100, qualityScore)),
            inaudibleCount,
            avgSpeakerConfidence,
            wordCount,
            segmentCount,
            speakerCount: speakers.length,
            avgSegmentLength: Math.round(avgSegmentLength * 10) / 10,
            details: {
                inaudiblePenalty,
                confidenceScore,
                lengthScore,
                speakerScore,
            },
        };
    }

    async updateMeetingQuality(meetingId: string): Promise<QualityMetrics> {
        const metrics = await this.calculateQuality(meetingId);

        await this.prisma.meeting.update({
            where: { id: meetingId },
            data: {
                qualityScore: metrics.qualityScore,
                inaudibleCount: metrics.inaudibleCount,
                avgSpeakerConfidence: metrics.avgSpeakerConfidence,
            },
        });

        return metrics;
    }

    async getQualityReport(meetingId: string, userId: string) {
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
        });

        if (!meeting) {
            return null;
        }

        const metrics = await this.calculateQuality(meetingId);

        return {
            meetingId,
            title: meeting.title,
            ...metrics,
            grade: this.getQualityGrade(metrics.qualityScore),
            recommendations: this.getRecommendations(metrics),
        };
    }

    private getQualityGrade(score: number): string {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    private getRecommendations(metrics: QualityMetrics): string[] {
        const recommendations: string[] = [];

        if (metrics.inaudibleCount > 5) {
            recommendations.push('Review and correct inaudible sections for better accuracy');
        }
        if (metrics.avgSpeakerConfidence < 0.7) {
            recommendations.push('Confirm speaker identities for better attribution');
        }
        if (metrics.avgSegmentLength < 10) {
            recommendations.push('Transcript has short segments - audio quality may be improved');
        }
        if (metrics.speakerCount === 1) {
            recommendations.push('Only one speaker detected - verify if more participants exist');
        }

        return recommendations;
    }
}
