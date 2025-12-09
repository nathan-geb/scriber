import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, MeetingStatus } from '@prisma/client';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

export interface MeetingFilters {
  search?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  cursor?: string;
  limit?: number;
  tagId?: string;
}

export interface PaginatedMeetings {
  items: Awaited<ReturnType<PrismaService['meeting']['findMany']>>;
  nextCursor?: string;
  hasMore: boolean;
}

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) { }

  async findAll(
    userId: string,
    filters?: MeetingFilters,
  ): Promise<PaginatedMeetings> {
    const where: Prisma.MeetingWhereInput = { userId };
    const limit = filters?.limit ?? 20;

    // Apply search filter
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { originalFileName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Apply status filter
    if (filters?.status) {
      where.status = filters.status as MeetingStatus;
    }

    // Apply tag filter
    if (filters?.tagId) {
      where.tags = {
        some: { tagId: filters.tagId },
      };
    }

    // Apply date range filter
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // Fetch one extra to check if there are more results
    const meetings = await this.prisma.meeting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(filters?.cursor && {
        skip: 1,
        cursor: { id: filters.cursor },
      }),
      include: {
        minutes: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    const hasMore = meetings.length > limit;
    const items = hasMore ? meetings.slice(0, -1) : meetings;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor, hasMore };
  }

  async findOne(id: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
        minutes: true,
        speakers: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private readonly logger = new Logger(MeetingsService.name);

  async delete(id: string, userId: string) {
    // Verify ownership and get file path
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
      select: { id: true, fileUrl: true },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    // Delete related records first (cascade delete if not set up)
    await this.prisma.$transaction([
      this.prisma.transcriptSegment.deleteMany({ where: { meetingId: id } }),
      this.prisma.minutes.deleteMany({ where: { meetingId: id } }),
      this.prisma.speaker.deleteMany({ where: { meetingId: id } }),
      this.prisma.meeting.delete({ where: { id } }),
    ]);

    // Clean up the audio file from disk (non-blocking, log errors)
    if (meeting.fileUrl) {
      void this.cleanupFile(meeting.fileUrl);
    }

    return { deleted: true };
  }

  /**
   * Safely delete a file from disk. Logs errors but doesn't throw.
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  async deleteMany(ids: string[], userId: string) {
    if (ids.length === 0) return { count: 0 };

    // Verify ownership of all meetings or just delete what belongs to user
    // The latter is safer/efficient

    // Using transaction for batch deletion might be heavy if lots of cascading
    // But direct deleteMany on meeting should cascade if prisma schema configured,
    // otherwise we might leave orphans if database level cascade isn't set.
    // For now, let's assume we need manual cleanup similar to single delete.
    // But manual cleanup for multiple IDs is tricky in one go without complex queries.
    // If we trust schema cascading or perform separate deletes:

    // Find all meetings owned by user with their file paths
    const meetings = await this.prisma.meeting.findMany({
      where: {
        id: { in: ids },
        userId
      },
      select: { id: true, fileUrl: true }
    });

    const validIds = meetings.map(m => m.id);

    if (validIds.length === 0) return { count: 0 };

    // Perform deletions in transaction
    await this.prisma.$transaction([
      this.prisma.transcriptSegment.deleteMany({ where: { meetingId: { in: validIds } } }),
      this.prisma.minutes.deleteMany({ where: { meetingId: { in: validIds } } }),
      this.prisma.speaker.deleteMany({ where: { meetingId: { in: validIds } } }),
      this.prisma.meeting.deleteMany({ where: { id: { in: validIds } } }),
    ]);

    // Clean up audio files from disk (non-blocking)
    for (const meeting of meetings) {
      if (meeting.fileUrl) {
        void this.cleanupFile(meeting.fileUrl);
      }
    }

    return { count: validIds.length };
  }

  async updateTitle(id: string, userId: string, title: string) {
    // Verify ownership
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.prisma.meeting.update({
      where: { id },
      data: { title },
      select: { id: true, title: true },
    });
  }
}
