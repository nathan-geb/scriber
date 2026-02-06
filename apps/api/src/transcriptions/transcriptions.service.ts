import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import type { StorageProvider } from '../storage/storage-provider.interface';
import type { TranscriptionProvider } from './interfaces/transcription-provider.interface';
import {
  splitAudioIntoChunks,
  cleanupChunks,
  getAudioDuration,
  isFfmpegAvailable,
} from '../common/audio-utils';
import * as path from 'path';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

@Injectable()
export class TranscriptionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private eventsGateway: EventsGateway,
    @Inject('STORAGE_PROVIDER') private storage: StorageProvider,
    @Inject('TRANSCRIPTION_PROVIDER')
    private transcriptionProvider: TranscriptionProvider,
  ) { }

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

  /**
   * Normalize and validate transcript segments:
   * - Sort by startTime
   * - Fix invalid timestamp ranges
   * - Clamp to audio duration
   * - Log quality issues
   */
  private normalizeSegments(
    segments: any[],
    maxDuration: number,
  ): { segments: any[]; hasQualityIssues: boolean } {
    if (!segments?.length) return { segments, hasQualityIssues: false };

    // Sort by startTime
    segments.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    let hasQualityIssues = false;
    let prevEndTime = 0;

    const normalized = segments.map((seg, i) => {
      let startTime = seg.startTime ?? 0;
      let endTime = seg.endTime ?? startTime + 5;

      // FIX 1: Detect and Fix "Minutes.Seconds" Halucination (e.g. 1.30 -> 90s)
      // If duration is > 60s, and we see small timestamps that look like MM.SS where endTime < startTime
      // OR if the value is unreasonably small for its position in sequence but fits MM.SS
      // This is risky, so we only trigger if endTime < startTime OR if explicitly detected as weird float
      if (endTime < startTime) {
        // Attempt decimal conversion: 2.15 -> 2*60 + 15 = 135
        const mins = Math.floor(startTime);
        // If "seconds" part is > 0.59, it's definitely not MM.SS, but check anyway
        const decimals = startTime % 1;
        // ... normalization logic is hard.
        // Better strategy: strict clamping.
        endTime = startTime + 5;
        hasQualityIssues = true;
      }

      // FIX 2: Strict chronological order
      if (startTime < prevEndTime) {
        // Overlap detected.
        // If overlap is small (< 1s), just nudge start time.
        // If huge, maybe the previous segment was too long?
        if (prevEndTime - startTime < 2.0) {
          startTime = prevEndTime;
        } else {
          // Big overlap: clamp previous segment's end time to this start time?
          // Or push this start time? Pushing start time is safer to preserve text order.
          startTime = prevEndTime;
        }
        hasQualityIssues = true;
      }

      // FIX 3: Ensure minimum duration (0.5s)
      if (endTime - startTime < 0.5) {
        endTime = startTime + 0.5;
        hasQualityIssues = true;
      }

      // FIX 4: Hard Clamp to Audio Duration (Critical Request)
      if (maxDuration > 0) {
        if (startTime >= maxDuration) {
          // Segment starts after audio ends. Drop or clamp?
          // Clamping start to maxDuration makes it 0-length.
          // We will filter these out later.
          startTime = maxDuration;
          endTime = maxDuration;
          hasQualityIssues = true;
        } else if (endTime > maxDuration) {
          endTime = maxDuration;
          hasQualityIssues = true;
        }
      }

      prevEndTime = endTime;
      return { ...seg, startTime, endTime };
    });

    // Validated 0-length segments removal
    const filtered = normalized.filter((s) => s.endTime > s.startTime);

    return { segments: filtered, hasQualityIssues };
  }

  // Chunk duration for long audio files (30 minutes) - Gemini 2.0 Flash handles large context well
  private static readonly CHUNK_DURATION_SECONDS = 1800;

  /**
   * Transcribe a single audio file (or chunk) using the injected provider.
   */
  private async transcribeAudioFile(
    filePath: string,
    chunkIndex: number,
    timestampOffset: number,
    context?: string,
  ): Promise<any[]> {
    if (!this.transcriptionProvider?.transcribe) {
      throw new Error('Transcription provider not configured');
    }

    const result = await this.transcriptionProvider.transcribe(filePath, {
      chunkIndex,
      timestampOffset,
      context,
    });

    return result.segments;
  }

  private async prepareAudioFile(
    meetingId: string,
    fileUrl: string,
  ): Promise<{ absolutePath: string; isTempFile: boolean }> {
    let absolutePath: string | undefined = undefined;
    let isTempFile = false;

    if (fileUrl.startsWith('recordings/')) {
      try {
        if (this.storage.name === 'local') {
          const localPath = join(process.cwd(), 'uploads', fileUrl);
          if (existsSync(localPath)) {
            absolutePath = localPath;
          }
        }

        if (!absolutePath) {
          console.log(
            `Meeting ${meetingId}: Downloading file from ${this.storage.name} storage`,
          );
          const buffer = await this.storage.download('recordings', fileUrl);
          const tempPath = join(
            tmpdir(),
            `scriber_${meetingId}_${path.basename(fileUrl)}`,
          );
          writeFileSync(tempPath, buffer);
          absolutePath = tempPath;
          isTempFile = true;
        }
      } catch (e) {
        console.error(`Failed to retrieve file from storage:`, e);
        throw new Error('Audio file could not be retrieved');
      }
    } else {
      absolutePath = path.resolve(fileUrl);
    }

    if (!absolutePath)
      throw new Error('Audio file path could not be determined');

    return { absolutePath, isTempFile };
  }

  private async processTranscriptionSegments(
    meetingId: string,
    userId: string,
    segments: any[],
    audioDuration: number,
  ) {
    let inaudibleCount = 0;
    const speakerConfidences: number[] = [];

    for (const segment of segments) {
      const speakerName = segment.speakerLabel || segment.speaker || 'Unknown';
      const nameConfidence =
        segment.nameConfidence ?? segment.confidence ?? 0.0;
      const languagesUsed = segment.languagesUsed || [];

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
        await this.prisma.speaker.update({
          where: { id: speaker.id },
          data: { nameConfidence },
        });
      }

      const startTime = segment.startTime || 0;
      let endTime = segment.endTime || 0;

      if (endTime < startTime && endTime < 10) {
        const mins = Math.floor(endTime);
        const secs = (endTime % 1) * 100;
        endTime = mins * 60 + secs;
      }

      if (endTime <= startTime) {
        endTime = startTime + 5;
      }

      await this.prisma.transcriptSegment.create({
        data: {
          meetingId,
          startTime,
          endTime,
          text: segment.text,
          originalText: segment.text,
          speakerId: speaker.id,
          languagesUsed: languagesUsed,
        },
      });
    }

    const avgSpeakerConfidence =
      speakerConfidences.length > 0
        ? speakerConfidences.reduce((a, b) => a + b, 0) /
        speakerConfidences.length
        : null;

    const totalSegments = segments.length;
    const qualityScore =
      totalSegments > 0
        ? Math.round(((totalSegments - inaudibleCount) / totalSegments) * 100)
        : null;

    return { inaudibleCount, avgSpeakerConfidence, qualityScore };
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
      // 1. Prepare audio file
      if (!meeting.fileUrl) throw new Error('Meeting file URL is missing');

      const { absolutePath, isTempFile } = await this.prepareAudioFile(
        meetingId,
        meeting.fileUrl,
      );

      // 2. Check if we need to split audio into chunks
      const audioDuration =
        meeting.durationSeconds || (await getAudioDuration(absolutePath));
      const needsChunking =
        audioDuration > TranscriptionsService.CHUNK_DURATION_SECONDS * 1.2;

      let segments: any[] = [];
      let tempDir = '';

      if (needsChunking && (await isFfmpegAvailable())) {
        // CHUNKED TRANSCRIPTION for long audio
        console.log(
          `Meeting ${meetingId}: Audio is ${Math.round(audioDuration)}s, using chunked transcription`,
        );

        const { chunks, tempDir: chunkDir } = await splitAudioIntoChunks(
          absolutePath,
          TranscriptionsService.CHUNK_DURATION_SECONDS,
        );
        tempDir = chunkDir;

        this.eventsGateway.emitPipelineStep(meeting.userId, meetingId, {
          step: 'transcription',
          status: 'processing',
          progress: 10,
        });

        // Transcribe chunks (Parallel would be faster, but sequential preserves context)
        // Let's use a Hybrid approach: Process in chunks of 2-3 to balance speed and context
        // For now, let's just make the sequential loop more robust.
        let context = '';
        const failedChunks: number[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const timestampOffset =
            i * TranscriptionsService.CHUNK_DURATION_SECONDS;

          const progress = 10 + Math.round((i / chunks.length) * 80);
          this.eventsGateway.emitPipelineStep(meeting.userId, meetingId, {
            step: 'transcription',
            status: 'processing',
            progress,
          });

          let retryCount = 0;
          const maxRetries = 2;
          let chunkSuccess = false;

          while (retryCount <= maxRetries && !chunkSuccess) {
            try {
              const chunkSegments = await this.transcribeAudioFile(
                chunks[i],
                i,
                timestampOffset,
                context,
              );
              segments.push(...chunkSegments);

              // Update context for next chunk (more segments for better context)
              if (chunkSegments.length > 0) {
                const lastSegments = chunkSegments.slice(-10); // More context
                const uniqueSpeakers = Array.from(
                  new Set(
                    chunkSegments.map(
                      (s: any) => `${s.speakerId} ("${s.speakerLabel}")`,
                    ),
                  ),
                ).join(', ');

                context =
                  `Known Speakers: ${uniqueSpeakers}\nLast ${lastSegments.length} lines:\n` +
                  lastSegments
                    .map(
                      (s: any) =>
                        `[${s.startTime.toFixed(1)}] ${s.speakerLabel || 'Unknown'} (${s.speakerId}): "${s.text}"`,
                    )
                    .join('\n');
              }
              chunkSuccess = true;
            } catch (chunkError) {
              retryCount++;
              console.error(
                `Chunk ${i} attempt ${retryCount} failed:`,
                chunkError,
              );
              if (retryCount > maxRetries) {
                failedChunks.push(i);
              } else {
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }
          }
        }

        // Cleanup temp files
        if (tempDir) {
          await cleanupChunks(tempDir);
        }

        if (failedChunks.length > 0) {
          console.error(
            `Meeting ${meetingId}: ${failedChunks.length}/${chunks.length} chunks failed completely.`,
          );
          if (failedChunks.length > chunks.length / 2) {
            throw new Error(
              'Transcription failed: Too many audio chunks failed to process.',
            );
          }
        }

        console.log(
          `Meeting ${meetingId}: Chunked transcription complete, ${segments.length} total segments`,
        );
      } else {
        // SINGLE-FILE TRANSCRIPTION for short audio (or ffmpeg not available)
        console.log(`Meeting ${meetingId}: Using single-file transcription`);
        segments = await this.transcribeAudioFile(absolutePath, 0, 0);
      }

      // Normalize and validate timestamps
      const { segments: normalizedSegments, hasQualityIssues } =
        this.normalizeSegments(segments, audioDuration);
      segments = normalizedSegments;

      if (hasQualityIssues) {
        console.warn(
          `Meeting ${meetingId}: transcript had timestamp quality issues that were auto-corrected`,
        );
      }

      // 3. Process Segments and Speakers with enhanced data
      const { inaudibleCount, avgSpeakerConfidence, qualityScore } =
        await this.processTranscriptionSegments(
          meetingId,
          meeting.userId,
          segments,
          audioDuration,
        );

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

      // Cleanup the downloaded temp file if it exists
      if (isTempFile && existsSync(absolutePath)) {
        try {
          unlinkSync(absolutePath);
        } catch (e) {
          console.warn('Failed to cleanup temp audio file:', e);
        }
      }

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

  /**
   * Enhance transcript using LLM for context-aware corrections.
   * Fixes homophones, punctuation, domain terminology, etc.
   * @param applyChanges - If false, returns corrections without applying them (preview mode)
   */
  async enhanceTranscript(
    meetingId: string,
    userId: string,
    applyChanges = true,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) throw new Error('Meeting not found');
    if (!meeting.transcript || meeting.transcript.length === 0) {
      throw new Error('No transcript available to enhance');
    }

    // Build transcript text for analysis
    const transcriptText = meeting.transcript
      .map((seg, i) => `[${i}] ${seg.speaker?.name || 'Unknown'}: ${seg.text}`)
      .join('\n');

    const prompt = `You are an expert transcript editor. Review and correct this meeting transcript for accuracy and clarity.

## Corrections to Make (in order of priority):

### 1. Multi-language & Code-switching
- If speakers switch between languages (e.g., English with Amharic, Spanish, etc.), ensure non-English words are correctly transcribed
- Fix phonetic approximations of foreign words to their correct spelling
- Preserve the natural code-switching patterns

### 2. [inaudible] & Unclear Sections
- Replace [inaudible], [unclear], or similar markers with contextually appropriate words when you can confidently infer what was said
- Use surrounding context, speaker patterns, and topic to determine likely words
- Only replace if you're confident; otherwise leave as-is

### 3. Speaker Name Detection
- Look for instances where speakers introduce themselves or address others by name (e.g., "Hi, I'm John", "Thanks, Sarah", "As John mentioned")
- If a speaker is currently labeled "Speaker 1" but introduces themselves, suggest the real name
- Include speaker name corrections in a separate field

### 4. Homophones & Common Errors
- Fix words that sound alike but are spelled differently (their/there/they're, your/you're, to/too/two, etc.)
- Fix common speech-to-text errors (gonna → going to is OK to keep for natural speech)

### 5. Punctuation & Clarity
- Improve sentence boundaries, add missing punctuation
- Fix run-on sentences
- Ensure proper capitalization at sentence starts

### 6. Domain Terms & Proper Nouns
- Capitalize company names, product names, technical terms correctly
- Standardize acronyms (API, UI, etc.)
- Fix obvious misspellings of technical terms

## Rules:
- Do NOT change the meaning of what was said
- Do NOT add content that wasn't in the original
- Do NOT remove content (except [inaudible] when replacing with inferred text)
- Preserve natural speech patterns (hesitations, filler words like "um", "uh" are OK)
- Keep the same number of segments - do not merge or split

## Output Format:
Return a JSON object with two arrays:

{
  "corrections": [
    {"segmentIndex": 0, "originalText": "exact original text", "correctedText": "improved text", "reason": "what was fixed"}
  ],
  "speakerNames": [
    {"segmentIndex": 3, "currentName": "Speaker 1", "suggestedName": "John", "evidence": "Speaker says 'Hi, I'm John'"}
  ]
}

If no corrections needed, return: {"corrections": [], "speakerNames": []}

Transcript:
${transcriptText.substring(0, 30000)}`;

    try {
      if (!this.transcriptionProvider.enhance) {
        return {
          corrections: [],
          speakerNames: [],
          applied: 0,
          speakersUpdated: 0,
        };
      }

      const parsed = await this.transcriptionProvider.enhance(transcriptText, {
        meetingId,
      });

      const corrections = parsed.corrections || [];
      const speakerNames = parsed.speakerNames || [];

      if (corrections.length === 0 && speakerNames.length === 0) {
        return {
          corrections: [],
          speakerNames: [],
          applied: 0,
          speakersUpdated: 0,
        };
      }

      // Preview mode - return without applying
      if (!applyChanges) {
        return { corrections, speakerNames, applied: 0, speakersUpdated: 0 };
      }

      // Apply text corrections to database
      let applied = 0;
      for (const correction of corrections) {
        const segment = meeting.transcript[correction.segmentIndex];
        if (!segment) continue;

        // Verify the original text matches (safety check)
        if (segment.text.trim() !== correction.originalText.trim()) {
          console.warn(
            `Skipping correction for segment ${correction.segmentIndex}: text mismatch`,
          );
          continue;
        }

        await this.prisma.transcriptSegment.update({
          where: { id: segment.id },
          data: { text: correction.correctedText },
        });
        applied++;
      }

      // Apply speaker name updates
      let speakersUpdated = 0;
      for (const nameSuggestion of speakerNames) {
        const segment = meeting.transcript[nameSuggestion.segmentIndex];
        if (!segment?.speaker) continue;

        // Only update if current name matches (safety check)
        if (segment.speaker.name !== nameSuggestion.currentName) continue;

        await this.prisma.speaker.update({
          where: { id: segment.speaker.id },
          data: {
            name: nameSuggestion.suggestedName,
            nameConfidence: 0.8, // Higher confidence since inferred from context
          },
        });
        speakersUpdated++;
      }

      return { corrections, speakerNames, applied, speakersUpdated };
    } catch (error) {
      console.error('Transcript enhancement failed:', error);
      throw error;
    }
  }

  async redactTranscript(
    meetingId: string,
    userId: string,
    applyChanges = true,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!meeting) throw new Error('Meeting not found');
    if (!meeting.transcript || meeting.transcript.length === 0) {
      throw new Error('No transcript available to redact');
    }

    // Build indexed transcript text for PII detection
    const transcriptText = meeting.transcript
      .map((seg, i) => `[${i}] ${seg.text}`)
      .join('\n');

    try {
      if (!this.transcriptionProvider.redact) {
        return {
          redactedSegments: [],
          itemsRedacted: 0,
          typesFound: [],
          applied: 0,
        };
      }

      const result = await this.transcriptionProvider.redact(transcriptText, {
        meetingId,
      });

      const redactedSegments = result.redactedSegments || [];

      if (redactedSegments.length === 0) {
        return { ...result, applied: 0 };
      }

      // Preview mode - return without applying
      if (!applyChanges) {
        return { ...result, applied: 0 };
      }

      // Apply redactions to database
      let applied = 0;
      for (const redactInfo of redactedSegments) {
        const segment = meeting.transcript[redactInfo.segmentIndex];
        if (!segment) continue;

        await this.prisma.transcriptSegment.update({
          where: { id: segment.id },
          data: { text: redactInfo.redactedText },
        });
        applied++;
      }

      return { ...result, applied };
    } catch (error) {
      console.error('Transcript redaction failed:', error);
      throw error;
    }
  }
  async updateSegment(
    meetingId: string,
    segmentId: string,
    text: string,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true },
    });

    if (!meeting) {
      throw new Error('Meeting not found or access denied');
    }

    const updatedSegment = await this.prisma.transcriptSegment.update({
      where: { id: segmentId, meetingId },
      data: { text },
    });

    return updatedSegment;
  }
}
