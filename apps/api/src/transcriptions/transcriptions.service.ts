import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import * as path from 'path';

@Injectable()
export class TranscriptionsService {
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
  }

  /**
   * Emit simulated progress at intervals since Gemini doesn't support streaming for audio
   */
  private emitProgressInterval(
    userId: string,
    meetingId: string,
    step: 'upload' | 'transcription' | 'minutes',
  ): NodeJS.Timeout {
    let progress = 20;
    return setInterval(() => {
      if (progress < 90) {
        progress += 15;
        this.eventsGateway.emitPipelineStep(userId, meetingId, {
          step,
          status: 'processing',
          progress,
        });
      }
    }, 3000); // Every 3 seconds
  }

  async transcribe(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) throw new Error('Meeting not found');

    // Update status to PROCESSING
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'PROCESSING_TRANSCRIPT' },
    });

    try {
      // 1. Upload to Gemini File API
      if (!meeting.fileUrl) throw new Error('Meeting file URL is missing');
      const absolutePath = path.resolve(meeting.fileUrl);

      // Detect mime type from file extension
      const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        webm: 'audio/webm',
        ogg: 'audio/ogg',
        aac: 'audio/aac',
      };
      const mimeType = mimeTypes[ext] || 'audio/mpeg';

      const uploadResponse = await this.fileManager.uploadFile(absolutePath, {
        mimeType,
        displayName: meeting.title,
      });

      console.log(
        `Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`,
      );

      // 2. Generate content using Gemini 2.0 Flash (stable model)
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const result = await model.generateContent([
        `### ROLE
You are a strict, JSON-first multilingual transcription engine for a business SaaS platform. Your output dictates the application's UI. Accuracy, formatting consistency, and schema compliance are critical.

### INPUT CONTEXT
- Audio: Business meeting with mixed languages (Amharic/English code-switching).
- Goal: Verbatim transcription for future speaker merging and automated minute generation.

### LINGUISTIC RULES (The "Amharish" Protocol)
1. **Script Preservation:**
   - Spoken English → Latin Script.
   - Spoken Amharic → Ge'ez Script.
   - **Mixed Morphology (CRITICAL):** If an English root word has Amharic grammatical suffixes, use the script of the suffix for the suffix ONLY, or phonetically transcribe the whole distinct sound in Ge'ez if it flows better.
     - *Preference:* "File-u" (English root, Amharic suffix) → "File-u" or "ፋይሉ" (Context dependent, but preserve the English root if distinct).
     - *Hard Rule:* NEVER write full English sentences in Ge'ez. NEVER write full Amharic sentences in Latin.

2. **Data Normalization:**
   - **Numbers:** Always transcribe numbers as digits (e.g., "2000 birr", "Project 5") unless used metaphorically ("one of a kind").
   - **Dates/Times:** Use standard formats if spoken naturally (e.g., "May 24th", "2:00 PM").

### STRUCTURAL RULES
1. **Diarization (FIFO Strategy):**
   - Assign \`speakerId\` sequentially based on first appearance: \`spk_1\` is the first voice heard, \`spk_2\` is the second.
   - **Naming:** Only use a real name in \`speakerLabel\` if the evidence is explicit (Self-intro or Direct Address). Otherwise, use "Unknown 1".

2. **Segmentation & Timestamping:**
   - **Duration Cap:** No segment may exceed 20 seconds. Force a split at a sentence boundary if a speaker talks longer.
   - **No Overlaps:** \`startTime\` must be < \`endTime\`. If speakers overlap, serialize the text: transcribe Speaker A, then Speaker B.
   - **Gap Handling:** If audio is completely unclear, insert a segment with text \`[inaudible]\` and the corresponding timestamp.

### OUTPUT FORMAT
- Return **ONLY** a raw JSON array.
- No markdown formatting (no \`\`\`json blocks).
- No preamble or explanation.

**Schema:**
[
  {
    "speakerId": "spk_1",
    "speakerLabel": "string (Name or 'Unknown X')",
    "text": "string (Verbatim content)",
    "startTime": float (seconds, 2 decimal places),
    "endTime": float (seconds, 2 decimal places),
    "languagesUsed": ["code1", "code2"],
    "nameConfidence": float (0.0 to 1.0; set to 0.0 if Unknown)
  }
]

**Example Output:**
[
  {
    "speakerId": "spk_1",
    "speakerLabel": "Nathan",
    "text": "Okay, let's look at the budget. ለእዚህ project 50,000 birr ያስፈልጋል።",
    "startTime": 0.0,
    "endTime": 5.45,
    "languagesUsed": ["en", "am"],
    "nameConfidence": 0.98
  },
  {
    "speakerId": "spk_2",
    "speakerLabel": "Unknown 1",
    "text": "That sounds reasonable.",
    "startTime": 5.5,
    "endTime": 7.12,
    "languagesUsed": ["en"],
    "nameConfidence": 0.0
  }
]`,
        {
          fileData: {
            mimeType,
            fileUri: uploadResponse.file.uri,
          },
        },
      ]);

      const responseText = result.response.text();
      const jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();

      let segments: any[] = [];
      try {
        segments = JSON.parse(jsonString);
      } catch (e) {
        console.error('Failed to parse JSON:', jsonString);
        segments = [
          { speakerLabel: 'Unknown', text: responseText, startTime: 0, endTime: 0 },
        ];
      }

      // 3. Process Segments and Speakers with enhanced data
      let inaudibleCount = 0;
      const speakerConfidences: number[] = [];

      for (const segment of segments) {
        // Handle both old format (speaker) and new format (speakerLabel)
        const speakerName = segment.speakerLabel || segment.speaker || 'Unknown';
        const nameConfidence = segment.nameConfidence ?? segment.confidence ?? 0.0;
        const languagesUsed = segment.languagesUsed || [];

        // Count inaudible markers
        if (segment.text?.includes('[inaudible]')) {
          inaudibleCount++;
        }

        let speaker = await this.prisma.speaker.findFirst({
          where: { meetingId, name: speakerName },
        });

        if (!speaker) {
          speaker = await this.prisma.speaker.create({
            data: {
              meetingId,
              name: speakerName,
              isUnknown: speakerName.toLowerCase().includes('unknown'),
              nameConfidence: nameConfidence,
              isConfirmed: false,
            },
          });
          speakerConfidences.push(nameConfidence);
        } else if (speaker.nameConfidence === 0 && nameConfidence > 0) {
          // Update speaker confidence if we get a better value
          await this.prisma.speaker.update({
            where: { id: speaker.id },
            data: { nameConfidence },
          });
        }

        await this.prisma.transcriptSegment.create({
          data: {
            meetingId: meeting.id,
            startTime: segment.startTime || 0,
            endTime: segment.endTime || 0,
            text: segment.text,
            speakerId: speaker.id,
            languagesUsed: languagesUsed,
          },
        });
      }

      // Calculate quality metrics
      const avgSpeakerConfidence = speakerConfidences.length > 0
        ? speakerConfidences.reduce((a, b) => a + b, 0) / speakerConfidences.length
        : null;

      const totalSegments = segments.length;
      const qualityScore = totalSegments > 0
        ? Math.round(((totalSegments - inaudibleCount) / totalSegments) * 100)
        : null;

      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'TRANSCRIPT_READY',
          inaudibleCount,
          avgSpeakerConfidence,
          qualityScore,
        },
      });

      // Send push notification
      await this.notifications.sendPush(
        meeting.userId,
        'Transcription Complete',
        `Your transcription for "${meeting.title}" is ready!`,
        { meetingId, type: 'TRANSCRIPTION_COMPLETE', action: 'view_meeting' },
      );

      return { status: 'TRANSCRIPT_READY', segments };
    } catch (error) {
      console.error('Transcription failed:', error);
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'FAILED' },
      });

      // Send failure notification
      await this.notifications.sendPush(
        meeting.userId,
        'Transcription Failed',
        `We couldn't transcribe "${meeting.title}". Please try again.`,
        { meetingId, type: 'TRANSCRIPTION_FAILED', action: 'view_meeting' },
      );

      throw error;
    }
  }
}
