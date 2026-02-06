import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, MeetingStatus } from '../generated/client';
import { SearchService } from '../search/search.service';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';
import type { StorageProvider } from '../storage/storage-provider.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface MeetingFilters {
  organizationId?: string;
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
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async findAll(
    userId: string,
    filters?: MeetingFilters,
  ): Promise<PaginatedMeetings> {
    const cacheKey = `meetings:${userId}:list:${JSON.stringify(filters || {})}`;
    const cached = await this.cacheManager.get<PaginatedMeetings>(cacheKey);
    if (cached) return cached;

    const where: Prisma.MeetingWhereInput = {};

    if (filters?.organizationId) {
      (where as any).organizationId = filters.organizationId;
    } else {
      where.userId = userId;
    }
    const limit = filters?.limit ?? 20;

    // Apply search filter (Old Prisma-based search - keeping for reference or fallback)
    /*
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { originalFileName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    */

    // Meilisearch-powered search
    if (filters?.search) {
      const searchResults = await this.searchService.search(filters.search, {
        organizationId: filters.organizationId,
        userId: filters.organizationId ? undefined : userId,
      });

      const resultIds = searchResults.hits.map((hit) => hit.id);
      if (resultIds.length === 0) {
        return { items: [], nextCursor: undefined, hasMore: false };
      }
      where.id = { in: resultIds };
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

    const result = { items, nextCursor, hasMore };
    await this.cacheManager.set(cacheKey, result, 30000); // 30s TTL
    return result;
  }

  async findOne(id: string, userId: string, organizationId?: string) {
    const cacheKey = `meetings:${userId}:detail:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const where: Prisma.MeetingWhereInput = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    } else {
      where.userId = userId;
    }

    const meeting = await (this.prisma.meeting as any).findFirst({
      where,
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
    await this.cacheManager.set(cacheKey, meeting, 30000); // 30s TTL
    return meeting;
  }

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
   * Safely delete a file from storage. Logs errors but doesn't throw.
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      if (filePath.startsWith('recordings/')) {
        const parts = filePath.split('/');
        const bucket = parts[0];
        const path = parts.slice(1).join('/');
        await this.storage.delete(bucket, path);
        this.logger.log(`Deleted storage file: ${filePath}`);
      } else if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted local file: ${filePath}`);
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
        userId,
      },
      select: { id: true, fileUrl: true },
    });

    const validIds = meetings.map((m) => m.id);

    if (validIds.length === 0) return { count: 0 };

    // Perform deletions in transaction
    await this.prisma.$transaction([
      this.prisma.transcriptSegment.deleteMany({
        where: { meetingId: { in: validIds } },
      }),
      this.prisma.minutes.deleteMany({
        where: { meetingId: { in: validIds } },
      }),
      this.prisma.speaker.deleteMany({
        where: { meetingId: { in: validIds } },
      }),
      this.prisma.meeting.deleteMany({ where: { id: { in: validIds } } }),
    ]);

    // Clean up audio files from disk (non-blocking)
    for (const meeting of meetings) {
    }

    // Invalidate caches
    for (const id of validIds) {
      await this.cacheManager.del(`meetings:${userId}:detail:${id}`);
    }

    return { count: validIds.length };
  }

  async updateTitle(id: string, userId: string, title: string) {
    // Verify ownership
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    const updated = await (this.prisma.meeting as any).update({
      where: { id },
      data: { title },
      include: { minutes: true },
    });

    // Async sync to search index
    await this.searchService.indexMeeting(updated, updated.minutes);

    await this.cacheManager.del(`meetings:${userId}:detail:${id}`);
    return { id: updated.id, title: updated.title };
  }

  async updateStatus(id: string, userId: string, status: MeetingStatus) {
    // Verify ownership
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    await this.cacheManager.del(`meetings:${userId}:detail:${id}`);
    return this.prisma.meeting.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  async getSignedUrl(bucket: string, path: string, expiresIn?: number) {
    return this.storage.getSignedUrl(bucket, path, expiresIn);
  }
}
