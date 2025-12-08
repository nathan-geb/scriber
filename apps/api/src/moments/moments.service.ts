import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MomentType } from '@prisma/client';

@Injectable()
export class MomentsService {
    constructor(private readonly prisma: PrismaService) { }

    async findByMeeting(meetingId: string, userId: string) {
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
        });

        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }

        return this.prisma.keyMoment.findMany({
            where: { meetingId },
            orderBy: { timestamp: 'asc' },
        });
    }

    async create(
        meetingId: string,
        userId: string,
        data: {
            timestamp: number;
            label: string;
            description?: string;
            type?: MomentType;
        },
    ) {
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
        });

        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }

        return this.prisma.keyMoment.create({
            data: {
                meetingId,
                timestamp: data.timestamp,
                label: data.label,
                description: data.description,
                type: data.type || 'CUSTOM',
                isAutomatic: false,
                createdBy: userId,
            },
        });
    }

    async update(
        id: string,
        userId: string,
        data: {
            label?: string;
            description?: string;
            type?: MomentType;
            timestamp?: number;
        },
    ) {
        const moment = await this.prisma.keyMoment.findFirst({
            where: { id },
            include: { meeting: { select: { userId: true } } },
        });

        if (!moment) {
            throw new NotFoundException('Moment not found');
        }

        if (moment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to edit this moment');
        }

        return this.prisma.keyMoment.update({
            where: { id },
            data: {
                label: data.label,
                description: data.description,
                type: data.type,
                timestamp: data.timestamp,
            },
        });
    }

    async delete(id: string, userId: string) {
        const moment = await this.prisma.keyMoment.findFirst({
            where: { id },
            include: { meeting: { select: { userId: true } } },
        });

        if (!moment) {
            throw new NotFoundException('Moment not found');
        }

        if (moment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to delete this moment');
        }

        await this.prisma.keyMoment.delete({ where: { id } });
        return { success: true };
    }

    // Auto-detect key moments from transcript (could be enhanced with AI)
    async autoDetect(meetingId: string, userId: string) {
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
            include: {
                transcript: {
                    orderBy: { startTime: 'asc' },
                },
            },
        });

        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }

        const detectedMoments: {
            timestamp: number;
            label: string;
            type: MomentType;
        }[] = [];

        // Simple keyword-based detection (can be replaced with AI)
        const patterns = [
            { regex: /\b(decide|decision|agreed|let's go with)\b/i, type: 'DECISION' as MomentType, label: 'Decision Made' },
            { regex: /\b(action item|todo|will do|I'll|need to)\b/i, type: 'ACTION_ITEM' as MomentType, label: 'Action Item' },
            { regex: /\?\s*$/i, type: 'QUESTION' as MomentType, label: 'Question Asked' },
            { regex: /\b(important|key point|note that|remember)\b/i, type: 'KEY_POINT' as MomentType, label: 'Key Point' },
            { regex: /\b(disagree|but|however|on the other hand)\b/i, type: 'DISAGREEMENT' as MomentType, label: 'Discussion Point' },
        ];

        for (const segment of meeting.transcript) {
            for (const pattern of patterns) {
                if (pattern.regex.test(segment.text)) {
                    // Avoid duplicates within 30 seconds
                    const hasSimilar = detectedMoments.some(
                        m => m.type === pattern.type && Math.abs(m.timestamp - segment.startTime) < 30,
                    );
                    if (!hasSimilar) {
                        detectedMoments.push({
                            timestamp: segment.startTime,
                            label: pattern.label,
                            type: pattern.type,
                        });
                    }
                }
            }
        }

        // Create moments in database
        const created = await Promise.all(
            detectedMoments.map(moment =>
                this.prisma.keyMoment.create({
                    data: {
                        meetingId,
                        timestamp: moment.timestamp,
                        label: moment.label,
                        type: moment.type,
                        isAutomatic: true,
                    },
                }),
            ),
        );

        return created;
    }
}
