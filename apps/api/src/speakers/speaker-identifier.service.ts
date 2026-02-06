import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withGeminiRetry, parseGeminiResponse } from '../common/gemini-retry';

interface IdentifiedSpeaker {
  speakerId: string;
  originalName: string;
  suggestedName: string;
  confidence: number;
  evidence: string;
}

interface SpeakerIdentificationResult {
  speakers: Array<{
    current_label: string;
    suggested_name: string;
    confidence: number;
    evidence: string;
  }>;
}

@Injectable()
export class SpeakerIdentifierService {
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Analyze transcript for speaker name clues and update speaker records.
   * Called automatically after transcription completes.
   */
  async identifyFromContext(meetingId: string): Promise<IdentifiedSpeaker[]> {
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
      return [];
    }

    // Get unique speakers
    const uniqueSpeakers = new Map<string, { id: string; name: string }>();
    for (const segment of meeting.transcript) {
      if (segment.speaker && !uniqueSpeakers.has(segment.speaker.id)) {
        uniqueSpeakers.set(segment.speaker.id, {
          id: segment.speaker.id,
          name: segment.speaker.name,
        });
      }
    }

    if (uniqueSpeakers.size === 0) {
      return [];
    }

    // Build transcript text for analysis
    const transcriptText = meeting.transcript
      .map((segment) => {
        const speaker = segment.speaker?.name || 'Unknown';
        return `${speaker}: ${segment.text}`;
      })
      .join('\n');

    // Build speaker list for context
    const speakerList = Array.from(uniqueSpeakers.values())
      .map((s) => s.name)
      .join(', ');

    const prompt = `You are analyzing a meeting transcript to identify speaker names.

Current speaker labels: ${speakerList}

Analyze the transcript for name clues:
1. How speakers address each other ("Hey John", "Thanks Sarah", "as Mike mentioned")
2. Self-introductions ("I'm John from...", "This is Sarah speaking")
3. References ("John's point is...", "what Sarah said earlier")
4. Sign-offs ("Thanks, John here, signing off")

IMPORTANT RULES:
- Only suggest names you are confident about based on evidence in the transcript
- If you cannot identify a speaker's real name, keep their original label
- Confidence score: 0.0-1.0 (1.0 = certain, 0.7+ = confident, <0.7 = uncertain)
- For uncertain names (confidence < 0.7), add "?" suffix to the name

Respond ONLY in valid JSON format:
{
  "speakers": [
    {
      "current_label": "Speaker 1",
      "suggested_name": "John",
      "confidence": 0.85,
      "evidence": "Called 'John' at multiple points in conversation"
    }
  ]
}

If no names can be identified, return: {"speakers": []}

Transcript:
${transcriptText.substring(0, 15000)}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const result = await withGeminiRetry(
        () => model.generateContent(prompt),
        `Speaker identification for meeting ${meetingId}`,
      );

      const responseText = result.response.text();
      const parsed = parseGeminiResponse<SpeakerIdentificationResult>(
        responseText,
        (text) => JSON.parse(text),
        'Speaker identification',
      );

      if (!parsed.speakers || parsed.speakers.length === 0) {
        return [];
      }

      const identifiedSpeakers: IdentifiedSpeaker[] = [];

      // Update speakers in database
      for (const suggestion of parsed.speakers) {
        // Find matching speaker by current name
        const matchingSpeaker = Array.from(uniqueSpeakers.values()).find(
          (s) => s.name === suggestion.current_label,
        );

        if (!matchingSpeaker) continue;

        // Don't update if suggested name is same as current
        if (matchingSpeaker.name === suggestion.suggested_name) continue;

        // Add "?" suffix for low confidence names
        let finalName = suggestion.suggested_name;
        if (suggestion.confidence < 0.7 && !finalName.endsWith('?')) {
          finalName = `${finalName}?`;
        }

        // Update speaker in database
        await this.prisma.speaker.update({
          where: { id: matchingSpeaker.id },
          data: {
            name: finalName,
            nameConfidence: suggestion.confidence,
            isUnknown: suggestion.confidence < 0.5,
            isConfirmed: false, // User hasn't confirmed yet
          },
        });

        identifiedSpeakers.push({
          speakerId: matchingSpeaker.id,
          originalName: matchingSpeaker.name,
          suggestedName: finalName,
          confidence: suggestion.confidence,
          evidence: suggestion.evidence,
        });
      }

      return identifiedSpeakers;
    } catch (error) {
      console.error(
        `Speaker identification failed for meeting ${meetingId}:`,
        error,
      );
      // Non-critical error - don't fail the pipeline
      return [];
    }
  }
}
