import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { NotificationsService } from '../notifications/notifications.service';

export type MinutesTemplate = 'EXECUTIVE' | 'DETAILED' | 'ACTION_ITEMS' | 'COMPREHENSIVE';

const TEMPLATE_PROMPTS: Record<MinutesTemplate, string> = {
  EXECUTIVE: `You are an expert meeting secretary. Generate a concise executive summary.
    
    Format in Markdown:
    1. **Executive Summary** (2-3 sentences max)
    2. **Key Decisions** (bullet points)
    3. **Action Items** (checklist with assignees if mentioned)
    
    Keep it brief and focused on outcomes.`,

  DETAILED: `You are an expert meeting secretary. Generate comprehensive meeting minutes.
    
    Format in Markdown:
    1. **Executive Summary**: Brief overview of purpose and outcome.
    2. **Attendees**: List speakers identified in transcript.
    3. **Key Discussion Points**: Detailed bullet points by topic.
    4. **Action Items**: Checklist with assignees and deadlines if mentioned.
    5. **Key Decisions**: Explicit decisions made.
    6. **Open Questions**: Unresolved items for follow-up.`,

  ACTION_ITEMS: `You are an expert meeting secretary. Extract ONLY action items from this meeting.
    
    Format in Markdown as a checklist:
    - [ ] **Task description** - Assigned to: [Name if mentioned] - Deadline: [Date if mentioned]
    
    Focus exclusively on tasks, commitments, and follow-ups.`,

  COMPREHENSIVE: `You are an expert meeting secretary. Generate complete, detailed meeting minutes.
    
    Format in Markdown with the following sections:
    
    # Meeting Minutes
    
    ## Executive Summary
    A brief 2-3 paragraph overview of the meeting's purpose, key outcomes, and overall conclusions.
    
    ## Attendees
    List all speakers/participants identified in the transcript.
    
    ## Agenda / Topics Covered
    Outline the main topics discussed during the meeting.
    
    ## Detailed Discussion Notes
    For each topic, provide comprehensive notes on what was discussed, different viewpoints shared, and context.
    
    ## Key Decisions Made
    List all explicit decisions with rationale where applicable.
    
    ## Action Items
    - [ ] **Task** - Owner: [Name] - Deadline: [Date if mentioned]
    
    ## Open Questions & Follow-ups
    Items that need further clarification or discussion in future meetings.
    
    ## Next Steps
    Summary of what happens after this meeting.
    
    Make the minutes thorough but well-organized with clear headings.`,
};

@Injectable()
export class MinutesService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateMinutes(
    meetingId: string,
    template: MinutesTemplate = 'DETAILED',
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');
    if (!meeting.transcript || meeting.transcript.length === 0) {
      throw new Error('No transcript available for this meeting');
    }

    // Update status
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'PROCESSING_MINUTES' },
    });

    try {
      // Construct prompt with transcript
      const transcriptText = meeting.transcript
        .map((segment) => {
          const speaker = segment.speaker
            ? segment.speaker.name
            : 'Unknown Speaker';
          return `${speaker}: ${segment.text}`;
        })
        .join('\n');

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `${TEMPLATE_PROMPTS[template]}

        Transcript:
        ${transcriptText}
      `;

      const result = await model.generateContent(prompt);
      const content = result.response.text();

      // Save Minutes
      const minutes = await this.prisma.minutes.upsert({
        where: { meetingId },
        update: { content },
        create: {
          meetingId,
          content,
        },
      });

      // Update Meeting Status
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
      });

      // Notify User
      await this.notifications.sendEmail(
        meeting.userId,
        `Minutes Ready: ${meeting.title}`,
        `Your meeting minutes for "${meeting.title}" are ready.\n\nSummary:\n${content.substring(0, 200)}...`,
      );

      return minutes;
    } catch (error) {
      console.error('Minutes generation failed:', error);
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  async regenerateMinutes(
    meetingId: string,
    userId: string,
    template: MinutesTemplate,
  ) {
    // Verify ownership
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.generateMinutes(meetingId, template);
  }

  async getMinutes(meetingId: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { meetingId },
    });
    // If not found, check if we should return 404 or null. Controller can handle.
    return minutes;
  }

  async updateMinutes(meetingId: string, content: string) {
    // Save current version before updating
    const existing = await this.prisma.minutes.findUnique({
      where: { meetingId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (existing) {
      // First edit: existing content becomes v1 (the "original")
      // Subsequent edits: increment from highest version
      const nextVersion =
        existing.versions.length > 0 ? existing.versions[0].version + 1 : 1;

      await this.prisma.minutesVersion.create({
        data: {
          minutesId: existing.id,
          content: existing.content,
          version: nextVersion,
        },
      });
    }

    return this.prisma.minutes.update({
      where: { meetingId },
      data: { content },
    });
  }

  async getVersionHistory(meetingId: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { meetingId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    if (!minutes) throw new NotFoundException('Minutes not found');
    return minutes.versions;
  }

  async revertToVersion(meetingId: string, version: number) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { meetingId },
      include: { versions: { where: { version } } },
    });

    if (!minutes || minutes.versions.length === 0) {
      throw new NotFoundException('Version not found');
    }

    const targetVersion = minutes.versions[0];
    return this.updateMinutes(meetingId, targetVersion.content);
  }

  async translateMinutes(meetingId: string, userId: string, language: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      include: { minutes: true },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');
    if (!meeting.minutes) throw new NotFoundException('Minutes not found');

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const prompt = `Translate the following meeting minutes into ${language}.
      Maintain the original Markdown structure and formatting exactly.
      Only output the translated markdown content.
      
      Minutes:
      ${meeting.minutes.content}
    `;

    const result = await model.generateContent(prompt);
    const translatedContent = result.response.text();

    // Update language indicator but don't overwrite original content
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { minutesLang: language },
    });

    // Return structured response instead of updating minutes
    return {
      minutes: translatedContent,
      language: language,
      originalMeetingId: meetingId,
    };
  }
}

