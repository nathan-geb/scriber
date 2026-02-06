import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, organizationId?: string) {
    return this.prisma.tag.findMany({
      where: organizationId ? { organizationId } : { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { meetings: true } },
      },
    });
  }

  async create(
    userId: string,
    name: string,
    organizationId?: string,
    color?: string,
  ) {
    try {
      return await this.prisma.tag.create({
        data: {
          userId,
          organizationId,
          name: name.trim(),
          ...(color && { color }),
        },
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tag with this name already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    userId: string,
    organizationId?: string,
    name?: string,
    color?: string,
  ) {
    const tag = await this.prisma.tag.findFirst({
      where: organizationId ? { id, organizationId } : { id, userId },
    });

    if (!tag) throw new NotFoundException('Tag not found');

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(color && { color }),
        },
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tag with this name already exists');
      }
      throw error;
    }
  }

  async delete(id: string, userId: string, organizationId?: string) {
    const tag = await this.prisma.tag.findFirst({
      where: organizationId ? { id, organizationId } : { id, userId },
    });

    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true };
  }

  // Meeting tag operations
  async addTagToMeeting(
    meetingId: string,
    tagId: string,
    userId: string,
    organizationId?: string,
  ) {
    // Verify ownership
    const [meeting, tag] = await Promise.all([
      this.prisma.meeting.findFirst({
        where: organizationId
          ? { id: meetingId, organizationId }
          : { id: meetingId, userId },
      }),
      this.prisma.tag.findFirst({
        where: organizationId
          ? { id: tagId, organizationId }
          : { id: tagId, userId },
      }),
    ]);

    if (!meeting) throw new NotFoundException('Meeting not found');
    if (!tag) throw new NotFoundException('Tag not found');

    try {
      return await this.prisma.meetingTag.create({
        data: { meetingId, tagId },
        include: { tag: true },
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tag already assigned to this meeting');
      }
      throw error;
    }
  }

  async removeTagFromMeeting(
    meetingId: string,
    tagId: string,
    userId: string,
    organizationId?: string,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    const meetingTag = await this.prisma.meetingTag.findFirst({
      where: { meetingId, tagId },
    });

    if (!meetingTag)
      throw new NotFoundException('Tag not assigned to this meeting');

    await this.prisma.meetingTag.delete({ where: { id: meetingTag.id } });
    return { removed: true };
  }

  async getMeetingTags(
    meetingId: string,
    userId: string,
    organizationId?: string,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.prisma.meetingTag.findMany({
      where: { meetingId },
      include: { tag: true },
    });
  }
}
