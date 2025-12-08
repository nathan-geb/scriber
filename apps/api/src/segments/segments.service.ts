import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SegmentsService {
    constructor(private readonly prisma: PrismaService) { }

    async findOne(segmentId: string, userId: string) {
        const segment = await this.prisma.transcriptSegment.findFirst({
            where: { id: segmentId },
            include: {
                meeting: { select: { userId: true } },
                speaker: true,
                edits: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!segment) {
            throw new NotFoundException('Segment not found');
        }

        if (segment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to access this segment');
        }

        return segment;
    }

    async update(
        segmentId: string,
        userId: string,
        newText: string,
        editReason?: string,
    ) {
        const segment = await this.prisma.transcriptSegment.findFirst({
            where: { id: segmentId },
            include: { meeting: { select: { userId: true } } },
        });

        if (!segment) {
            throw new NotFoundException('Segment not found');
        }

        if (segment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to edit this segment');
        }

        // Create edit history record and update segment in transaction
        const [, updatedSegment] = await this.prisma.$transaction([
            this.prisma.segmentEdit.create({
                data: {
                    segmentId,
                    previousText: segment.text,
                    newText,
                    editedBy: userId,
                    editReason,
                },
            }),
            this.prisma.transcriptSegment.update({
                where: { id: segmentId },
                data: { text: newText },
                include: { speaker: true },
            }),
        ]);

        return updatedSegment;
    }

    async getEditHistory(segmentId: string, userId: string) {
        const segment = await this.prisma.transcriptSegment.findFirst({
            where: { id: segmentId },
            include: { meeting: { select: { userId: true } } },
        });

        if (!segment) {
            throw new NotFoundException('Segment not found');
        }

        if (segment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to access this segment');
        }

        return this.prisma.segmentEdit.findMany({
            where: { segmentId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async revertToVersion(segmentId: string, editId: string, userId: string) {
        const segment = await this.prisma.transcriptSegment.findFirst({
            where: { id: segmentId },
            include: { meeting: { select: { userId: true } } },
        });

        if (!segment) {
            throw new NotFoundException('Segment not found');
        }

        if (segment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to edit this segment');
        }

        const edit = await this.prisma.segmentEdit.findFirst({
            where: { id: editId, segmentId },
        });

        if (!edit) {
            throw new NotFoundException('Edit version not found');
        }

        // Revert to the previous text from that edit
        const [, updatedSegment] = await this.prisma.$transaction([
            this.prisma.segmentEdit.create({
                data: {
                    segmentId,
                    previousText: segment.text,
                    newText: edit.previousText,
                    editedBy: userId,
                    editReason: `Reverted to version from ${edit.createdAt.toISOString()}`,
                },
            }),
            this.prisma.transcriptSegment.update({
                where: { id: segmentId },
                data: { text: edit.previousText },
                include: { speaker: true },
            }),
        ]);

        return updatedSegment;
    }

    async reassignSpeaker(segmentId: string, newSpeakerId: string, userId: string) {
        const segment = await this.prisma.transcriptSegment.findFirst({
            where: { id: segmentId },
            include: { meeting: { select: { userId: true, id: true } } },
        });

        if (!segment) {
            throw new NotFoundException('Segment not found');
        }

        if (segment.meeting.userId !== userId) {
            throw new ForbiddenException('Not authorized to edit this segment');
        }

        // Verify the new speaker belongs to the same meeting
        const newSpeaker = await this.prisma.speaker.findFirst({
            where: { id: newSpeakerId, meetingId: segment.meeting.id },
        });

        if (!newSpeaker) {
            throw new NotFoundException('Speaker not found in this meeting');
        }

        return this.prisma.transcriptSegment.update({
            where: { id: segmentId },
            data: { speakerId: newSpeakerId },
            include: { speaker: true },
        });
    }
}
