import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MomentType } from '../generated/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withGeminiRetry } from '../common/gemini-retry';

@Injectable()
export class MomentsService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async findByMeeting(
    meetingId: string,
    userId: string,
    organizationId?: string,
  ) {
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
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
    organizationId: string | undefined,
    data: {
      timestamp: number;
      label: string;
      description?: string;
      type?: MomentType;
    },
  ) {
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
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

  // Auto-detect key moments from transcript using AI
  async autoDetect(meetingId: string, userId: string, organizationId?: string) {
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const transcript = (meeting as any).transcript;
    if (!transcript || transcript.length === 0) {
      return [];
    }

    const transcriptText = transcript
      .map(
        (s: any) =>
          `[${s.startTime.toFixed(1)}s] ${s.speaker?.name || 'Unknown'}: ${s.text}`,
      )
      .join('\n');

    const prompt = `You are a meeting intelligence agent. Analyze the following transcript and extract key moments.
        
        Focus on:
        1. **DECISION**: Explicit choices or agreements made.
        2. **ACTION_ITEM**: Tasks assigned to individuals or teams.
        3. **QUESTION**: Critical open questions that need follow-up.
        4. **KEY_POINT**: Important insights or context.
        5. **DISAGREEMENT**: Points of contention or different viewpoints.

        Format your response as a valid JSON array of objects:
        [
          {
            "timestamp": number (in seconds),
            "label": "Short, catchy title",
            "description": "Short explanation (1-2 sentences)",
            "type": "DECISION" | "ACTION_ITEM" | "QUESTION" | "KEY_POINT" | "DISAGREEMENT"
          }
        ]

        Transcript:
        ${transcriptText}`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await withGeminiRetry(
      () => model.generateContent(prompt),
      `Key moment detection for meeting ${meetingId}`,
    );

    const responseText = result.response.text();
    let jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonString = arrayMatch[0];

    let detectedMoments: any[] = [];
    try {
      detectedMoments = JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse moments JSON:', e);
      return [];
    }

    // Create moments in database
    const created = await Promise.all(
      detectedMoments.map((moment) =>
        this.prisma.keyMoment.create({
          data: {
            meetingId,
            timestamp: moment.timestamp,
            label: moment.label,
            description: moment.description,
            type: moment.type || 'KEY_POINT',
            isAutomatic: true,
          },
        }),
      ),
    );

    return created;
  }
}
