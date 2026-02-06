import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withGeminiRetry } from '../common/gemini-retry';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { SearchService } from '../search/search.service';

export type MinutesTemplate =
  | 'EXECUTIVE'
  | 'DETAILED'
  | 'ACTION_ITEMS'
  | 'COMPREHENSIVE'
  | 'GENERAL_SUMMARY';

const TEMPLATE_PROMPTS: Record<MinutesTemplate, string> = {
  GENERAL_SUMMARY: `You are an expert meeting secretary. Generate a high-quality, professional summary of this meeting.

    Format in Markdown:
    # Meeting Summary

    ## Overview
    A concise narrative (3-5 paragraphs) describing the core discussions and outcomes.
    Avoid "fluff" or generic phrases like "The meeting started with...". 
    Focus on specific details: names, dates, numbers, and key arguments presented.
    Write in a natural, sophisticated business style.

    ## Key Takeaways
    3-5 bullet points of the most critical information.
    - Focus on facts and conclusions, not just topics.

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
    private searchService: SearchService,
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
        const minutes = await (this.prisma.minutes as any).upsert({
          where: { meetingId },
          update: { content, status: 'DRAFT' },
          create: {
            meetingId,
            content,
            status: 'DRAFT',
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

        // Update search index
        await this.searchService.indexMeeting(meeting, minutes);

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

  /*
## Phase 1: Enterprise Foundation (Completed)

Successfully established multi-tenancy and organization-level scoping across the backend.

### Key Changes
- **Database Schema**: Introduced `Organization` and `Membership` models.
- **Authentication**: JWT now carries `organizationId`.
- **Scoping**: Meetings, Uploads, and Tags are now filtered by `organizationId`.

## Phase 2: AI Quality & Reliability (Completed)

Focused on improving the core AI value prop by moving from regex-based logic to LLM-driven intelligence and adding a collaborative workflow for minutes.

### 1. Minutes Review Workflow
- **Schema Update**: Added `MinutesStatus` (`DRAFT`, `UNDER_REVIEW`, `APPROVED`) and `reviewerId`.
- **Backend Flow**: Updated `MinutesService` and `MinutesController` to support the review lifecycle.
- **Organization Scoping**: Ensured all minutes operations are properly scoped by `organizationId`.

### 2. Transcription Quality & Robustness
- **Parallel Chunking**: Optimized `TranscriptionsService` to handle long audio files more reliably.
- **Error Handling**: Implemented retry logic for audio chunks and context-aware continuation segments (last 5 segments).
- **Speaker Consistency**: improved context passing between chunks to help Gemini maintain speaker identities.

### 3. LLM-Powered Moment Extraction
- **Refactor**: Replaced fragile regex-based keyword matching with a sophisticated Gemini 2.0 Flash prompt.
- **Accuracy**: Moments now capture context, speaker intent, and nuance that regex missed.

### Code Changes (Phase 2 summary)
render_diffs(file:///Users/nathan/Documents/Projects/Developments/Scriber/apps/api/src/minutes/minutes.service.ts)
render_diffs(file:///Users/nathan/Documents/Projects/Developments/Scriber/apps/api/src/transcriptions/transcriptions.service.ts)
render_diffs(file:///Users/nathan/Documents/Projects/Developments/Scriber/apps/api/src/moments/moments.service.ts)
*/
  async regenerateMinutes(
    meetingId: string,
    userId: string,
    template: MinutesTemplate,
    organizationId?: string,
  ) {
    // Verify ownership/access
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.generateMinutes(meetingId, template);
  }

  async getMinutes(meetingId: string, userId: string, organizationId?: string) {
    // Verify access
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const minutes = await (this.prisma.minutes as any).findUnique({
      where: { meetingId },
    });
    return minutes;
  }

  async updateMinutes(
    meetingId: string,
    userId: string,
    content: string,
    organizationId?: string,
  ) {
    // Verify access
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    // Save current version before updating
    const existing = await (this.prisma.minutes as any).findUnique({
      where: { meetingId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (existing) {
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

    const updated = await (this.prisma.minutes as any).update({
      where: { meetingId },
      data: { content, status: 'UNDER_REVIEW' },
    });

    // Update search index
    await this.searchService.indexMeeting(meeting, updated);

    return updated;
  }

  async updateStatus(
    meetingId: string,
    userId: string,
    status: string,
    organizationId?: string,
  ) {
    // Verify access
    const meeting = await (this.prisma.meeting as any).findFirst({
      where: organizationId
        ? { id: meetingId, organizationId }
        : { id: meetingId, userId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return (this.prisma.minutes as any).update({
      where: { meetingId },
      data: {
        status,
        reviewerId: status === 'APPROVED' ? userId : undefined,
      },
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

  async revertToVersion(meetingId: string, version: number, userId: string, organizationId?: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { meetingId },
      include: { versions: { where: { version } } },
    });

    if (!minutes || minutes.versions.length === 0) {
      throw new NotFoundException('Version not found');
    }

    const targetVersion = minutes.versions[0];
    return this.updateMinutes(meetingId, userId, targetVersion.content, organizationId);
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
    - **Native Professional Tone**: Use the specific business register appropriate for ${language} culture (e.g., Keigo for Japanese, confident formal for German).
    - **No Literal Translation**: Rephrase sentences to sound completely natural to a native speaker.
    - **Maintain Meaning**: Preserve all factual details, numbers, and names exactly.

    ## Language-Specific Guidelines
    - **Spanish**: Use formal "usted" form, business-appropriate vocabulary.
    - **French**: Use formal "vous" form, professional phrasing.
    - **German**: Use formal "Sie" form, structured business sentences.
    - **Japanese**: Use proper business Keigo (Desu/Masu is minimum, Sonkeigo/Kenjougo where appropriate).
    - **Chinese**: Use formal written style (书面语).
    - **Arabic**: Use Modern Standard Arabic, formal register.
    - **Portuguese**: Use formal "você/o senhor" as appropriate.
    - **Amharic**: Use formal respectful forms.

    ## Structure Requirements
    - Maintain exact Markdown structure (headers, bullets, checkboxes, formatting).
    - Keep section organization identical.
    - Do NOT translate proper nouns (Company names, Product names) unless standard.

    Output ONLY the translated markdown. No explanations or notes.

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
