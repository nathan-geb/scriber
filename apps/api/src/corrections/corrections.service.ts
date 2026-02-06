import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCorrectionDto {
  segmentId: string;
  originalText: string;
  correctedText: string;
}

@Injectable()
export class CorrectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCorrectionDto) {
    // Verify segment exists and user has access
    const segment = await this.prisma.transcriptSegment.findUnique({
      where: { id: dto.segmentId },
      include: { meeting: true },
    });

    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    if (segment.meeting.userId !== userId) {
      throw new ForbiddenException('You do not have access to this segment');
    }

    // Create the correction
    const correction = await this.prisma.transcriptCorrection.create({
      data: {
        segmentId: dto.segmentId,
        originalText: dto.originalText,
        correctedText: dto.correctedText,
        correctedBy: userId,
      },
    });

    // Update the segment text with the correction applied
    const updatedText = segment.text.replace(
      dto.originalText,
      dto.correctedText,
    );
    await this.prisma.transcriptSegment.update({
      where: { id: dto.segmentId },
      data: { text: updatedText },
    });

    // Update meeting inaudible count
    const newInaudibleCount = (updatedText.match(/\[inaudible\]/gi) || [])
      .length;
    const allSegments = await this.prisma.transcriptSegment.findMany({
      where: { meetingId: segment.meetingId },
      select: { text: true },
    });

    const totalInaudibles = allSegments.reduce((count, seg) => {
      return count + (seg.text.match(/\[inaudible\]/gi) || []).length;
    }, 0);

    const totalSegments = allSegments.length;
    const qualityScore =
      totalSegments > 0
        ? Math.round(((totalSegments - totalInaudibles) / totalSegments) * 100)
        : null;

    await this.prisma.meeting.update({
      where: { id: segment.meetingId },
      data: {
        inaudibleCount: totalInaudibles,
        qualityScore,
      },
    });

    return correction;
  }

  async findBySegment(segmentId: string) {
    return this.prisma.transcriptCorrection.findMany({
      where: { segmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByMeeting(meetingId: string) {
    return this.prisma.transcriptCorrection.findMany({
      where: {
        segment: { meetingId },
      },
      include: {
        segment: {
          select: { id: true, startTime: true, endTime: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(userId: string, correctionId: string) {
    const correction = await this.prisma.transcriptCorrection.findUnique({
      where: { id: correctionId },
      include: { segment: { include: { meeting: true } } },
    });

    if (!correction) {
      throw new NotFoundException('Correction not found');
    }

    if (correction.segment.meeting.userId !== userId) {
      throw new ForbiddenException('You do not have access to this correction');
    }

    // Revert the text change
    const segment = correction.segment;
    const revertedText = segment.text.replace(
      correction.correctedText,
      correction.originalText,
    );

    await this.prisma.transcriptSegment.update({
      where: { id: segment.id },
      data: { text: revertedText },
    });

    return this.prisma.transcriptCorrection.delete({
      where: { id: correctionId },
    });
  }
}
