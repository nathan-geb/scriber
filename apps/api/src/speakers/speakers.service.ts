import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpeakersService {
  constructor(private prisma: PrismaService) {}

  async findByMeeting(meetingId: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.prisma.speaker.findMany({
      where: { meetingId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { segments: true } },
      },
    });
  }

  async rename(id: string, userId: string, newName: string) {
    const speaker = await this.prisma.speaker.findFirst({
      where: { id },
      include: { meeting: true },
    });

    if (!speaker || speaker.meeting.userId !== userId) {
      throw new NotFoundException('Speaker not found');
    }

    return this.prisma.speaker.update({
      where: { id },
      data: {
        name: newName.trim(),
        isUnknown: false,
      },
    });
  }

  async merge(sourceId: string, targetId: string, userId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException('Cannot merge speaker with itself');
    }

    // Verify both speakers exist and belong to user's meeting
    const [source, target] = await Promise.all([
      this.prisma.speaker.findFirst({
        where: { id: sourceId },
        include: { meeting: true },
      }),
      this.prisma.speaker.findFirst({
        where: { id: targetId },
        include: { meeting: true },
      }),
    ]);

    if (!source || source.meeting.userId !== userId) {
      throw new NotFoundException('Source speaker not found');
    }
    if (!target || target.meeting.userId !== userId) {
      throw new NotFoundException('Target speaker not found');
    }
    if (source.meetingId !== target.meetingId) {
      throw new BadRequestException(
        'Cannot merge speakers from different meetings',
      );
    }

    // Move all segments from source to target, then delete source
    await this.prisma.$transaction([
      this.prisma.transcriptSegment.updateMany({
        where: { speakerId: sourceId },
        data: { speakerId: targetId },
      }),
      this.prisma.speaker.delete({ where: { id: sourceId } }),
    ]);

    return this.prisma.speaker.findUnique({
      where: { id: targetId },
      include: { _count: { select: { segments: true } } },
    });
  }

  async confirm(id: string, userId: string) {
    const speaker = await this.prisma.speaker.findFirst({
      where: { id },
      include: { meeting: true },
    });

    if (!speaker || speaker.meeting.userId !== userId) {
      throw new NotFoundException('Speaker not found');
    }

    return this.prisma.speaker.update({
      where: { id },
      data: {
        isConfirmed: true,
        nameConfidence: 1.0,
        isUnknown: false,
      },
    });
  }
}
