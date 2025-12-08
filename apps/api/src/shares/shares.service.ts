import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShareType } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class SharesService {
    constructor(private prisma: PrismaService) { }

    async createShareLink(
        userId: string,
        meetingId: string,
        shareType: ShareType = 'FULL',
        expiresIn?: number, // Hours until expiration
    ) {
        // Verify meeting belongs to user
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
        });

        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }

        // Generate unique token
        const token = randomBytes(32).toString('hex');

        // Calculate expiration
        const expiresAt = expiresIn
            ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
            : null;

        return this.prisma.shareLink.create({
            data: {
                meetingId,
                token,
                shareType,
                expiresAt,
            },
        });
    }

    async getShareLinks(userId: string, meetingId: string) {
        // Verify meeting belongs to user
        const meeting = await this.prisma.meeting.findFirst({
            where: { id: meetingId, userId },
        });

        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }

        return this.prisma.shareLink.findMany({
            where: { meetingId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async revokeShareLink(userId: string, shareId: string) {
        // Find share link and verify ownership
        const shareLink = await this.prisma.shareLink.findUnique({
            where: { id: shareId },
            include: { meeting: true },
        });

        if (!shareLink || shareLink.meeting.userId !== userId) {
            throw new NotFoundException('Share link not found');
        }

        return this.prisma.shareLink.delete({
            where: { id: shareId },
        });
    }

    async getSharedContent(token: string) {
        const shareLink = await this.prisma.shareLink.findUnique({
            where: { token },
            include: {
                meeting: {
                    include: {
                        minutes: true,
                        transcript: {
                            orderBy: { startTime: 'asc' },
                            include: { speaker: true },
                        },
                    },
                },
            },
        });

        if (!shareLink) {
            throw new NotFoundException('Share link not found or invalid');
        }

        // Check expiration
        if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
            throw new NotFoundException('Share link has expired');
        }

        const { meeting } = shareLink;

        // Return content based on share type
        const response: any = {
            title: meeting.title,
            createdAt: meeting.createdAt,
            shareType: shareLink.shareType,
        };

        if (shareLink.shareType === 'FULL' || shareLink.shareType === 'MINUTES') {
            response.minutes = meeting.minutes?.content || null;
        }

        if (shareLink.shareType === 'FULL' || shareLink.shareType === 'TRANSCRIPT') {
            response.transcript = meeting.transcript?.map((seg) => ({
                speaker: seg.speaker?.name || 'Unknown',
                startTime: seg.startTime,
                endTime: seg.endTime,
                text: seg.text,
            }));
        }

        return response;
    }
}
