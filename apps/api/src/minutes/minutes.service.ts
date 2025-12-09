import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withGeminiRetry } from '../common/gemini-retry';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';

export type MinutesTemplate =
  | 'EXECUTIVE'
  | 'DETAILED'
  | 'ACTION_ITEMS'
  | 'COMPREHENSIVE'
  | 'GENERAL_SUMMARY';

const TEMPLATE_PROMPTS: Record<MinutesTemplate, string> = {
  GENERAL_SUMMARY: `You are an expert meeting secretary. Generate a clear, narrative summary of this meeting.
    
    Format in Markdown:
    # Meeting Summary
    
    ## Overview
    A flowing narrative (3-5 paragraphs) describing what was discussed in the meeting.
    Write in a natural, readable style - not bullet points.
    
    ## Key Takeaways
    3-5 bullet points of the most important information from the meeting.
    
    ## Participants
    List the speakers identified in the transcript.
    
    Do NOT include action items or tasks - this is purely an informational summary.`,

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
    private eventsGateway: EventsGateway,
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

      // Start progress simulation
      let progress = 10;
      const progressInterval = setInterval(() => {
        if (progress < 90) {
          progress += 10;
          this.eventsGateway.emitPipelineStep(meeting.userId, meetingId, {
            step: 'minutes',
            status: 'processing',
            progress,
          });
        }
      }, 2000);

      try {
        const result = await withGeminiRetry(
          () => model.generateContent(prompt),
          `Minutes generation for meeting ${meetingId}`,
        );
        const content = result.response.text();

        clearInterval(progressInterval);

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

        // Emit completion event
        this.eventsGateway.emitPipelineStep(meeting.userId, meetingId, {
          step: 'minutes',
          status: 'completed',
          progress: 100,
        });

        // Notify User
        await this.notifications.sendEmail(
          meeting.userId,
          `Minutes Ready: ${meeting.title} `,
          `Your meeting minutes for "${meeting.title}" are ready.\n\nSummary: \n${content.substring(0, 200)}...`,
        );

        return minutes;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
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

    const prompt = `You are a professional meeting secretary fluent in ${language}.

Translate the following meeting minutes into ${language} using:

## Translation Quality Requirements
        - Use professional business register appropriate for ${language} culture
          - Apply native - sounding phrasing(NOT literal word -for-word translation)
        - Maintain proper formal grammar and business terminology
          - Preserve the original meaning while adapting to ${language} conventions

## Language - Specific Guidelines
        - ** Spanish **: Use formal "usted" form, business - appropriate vocabulary
          - ** French **: Use formal "vous" form, professional phrasing
            - ** German **: Use formal "Sie" form, structured sentences
              - ** Japanese **: Use です / ます form, appropriate keigo(敬語)
                - ** Chinese **: Use formal written style(书面语)
                  - ** Arabic **: Use Modern Standard Arabic, formal register
                    - ** Portuguese **: Use formal "você/o senhor" as appropriate
                      - ** Amharic **: Use formal respectful forms

## Structure Requirements
        - Maintain exact Markdown structure(headers, bullets, checkboxes, formatting)
          - Keep section organization identical
            - Preserve any names, dates, or specific terminology

Output ONLY the translated markdown.No explanations or notes.

Minutes to translate:
${meeting.minutes.content}
      `;

    const result = await withGeminiRetry(
      () => model.generateContent(prompt),
      `Translation to ${language} for meeting ${meetingId}`,
    );
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

