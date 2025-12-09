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
        `You are a professional audio transcription engine. Transcribe the ENTIRE audio file from beginning to end.

## CRITICAL REQUIREMENTS

1. **COMPLETE TRANSCRIPTION**: You MUST transcribe the ENTIRE audio from 0:00 to the very end. Do NOT stop early. If the audio is 4 minutes long, your last segment's endTime should be near 240 seconds.

2. **TIMESTAMP FORMAT**: All timestamps must be in SECONDS as decimal numbers.
   - CORRECT: 65.5 (meaning 1 minute 5.5 seconds)
   - WRONG: 1.05 (this is NOT how to represent 1 minute 5 seconds)
   - For 2 minutes 30 seconds, use: 150.0
   - For 45 seconds, use: 45.0

3. **TIMESTAMP RULES**:
   - startTime must ALWAYS be less than endTime
   - Each segment's startTime should be >= previous segment's endTime
   - Timestamps must be sequential and cover the entire audio duration

## SPEAKER IDENTIFICATION

- Assign speakerId sequentially: spk_1, spk_2, spk_3, etc.
- Use real names for speakerLabel ONLY if explicitly stated in the audio (self-introduction or direct address)
- Otherwise use "Unknown 1", "Unknown 2", etc.
- Set nameConfidence: 0.9+ if name is clear, 0.0 if unknown

## LANGUAGE HANDLING

This audio may contain multiple languages (English, Amharic, or mixed):
- English → Use Latin script
- Amharic → Use Ge'ez script (ግዕዝ)
- Code-switching is common - preserve the original language in its native script
- Record all languages used in each segment in the languagesUsed array: ["en"], ["am"], or ["en", "am"]

## SEGMENTATION RULES

- Maximum segment length: 20 seconds
- Split at natural sentence boundaries
- If audio is unclear, use text: "[inaudible]"
- If there's silence, you may skip it but maintain accurate timestamps

## OUTPUT FORMAT

Return ONLY a valid JSON array. No markdown, no explanation, no preamble.

[
  {
    "speakerId": "spk_1",
    "speakerLabel": "Unknown 1",
    "text": "Hello everyone, welcome to the meeting.",
    "startTime": 0.0,
    "endTime": 3.5,
    "languagesUsed": ["en"],
    "nameConfidence": 0.0
  },
  {
    "speakerId": "spk_2",
    "speakerLabel": "Dr. Sarah",
    "text": "Thank you. Let's begin with the agenda.",
    "startTime": 3.8,
    "endTime": 6.2,
    "languagesUsed": ["en"],
    "nameConfidence": 0.95
  }
]

Remember: Transcribe the COMPLETE audio. Your final segment's endTime should match the audio's total duration.`,
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

        // Validate and correct timestamps
        const startTime = segment.startTime || 0;
        let endTime = segment.endTime || 0;

        // Fix invalid timestamps where endTime < startTime
        // This can happen when AI outputs minutes.seconds format (e.g., 1.09 meaning 1 min 9 sec = 69 sec)
        if (endTime < startTime && endTime < 10) {
          // Likely minutes.seconds format - convert to pure seconds
          const mins = Math.floor(endTime);
          const secs = (endTime % 1) * 100;
          endTime = mins * 60 + secs;
        }

        // If still invalid, set endTime to startTime + estimated duration
        if (endTime <= startTime) {
          endTime = startTime + 5; // Default 5 second segment
        }

        await this.prisma.transcriptSegment.create({
          data: {
            meetingId: meeting.id,
            startTime,
            endTime,
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
