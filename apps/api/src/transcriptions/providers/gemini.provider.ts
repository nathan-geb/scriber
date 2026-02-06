import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionOptions,
  EnhancementOptions,
  EnhancementResult,
  RedactionOptions,
  RedactionResult,
} from '../interfaces/transcription-provider.interface';
import { withGeminiRetry } from '../../common/gemini-retry';
import * as path from 'path';

@Injectable()
export class GeminiProvider implements TranscriptionProvider {
  readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
  }

  async transcribe(
    filePath: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    // ... (existing transcribe implementation)
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
    };
    const mimeType = mimeTypes[ext] || 'audio/mpeg';

    const uploadResponse = await this.fileManager.uploadFile(filePath, {
      mimeType,
      displayName: `chunk_${options?.chunkIndex || 0}`,
    });

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 65536 },
    });

    const contextPrompt = options?.context
      ? `\n## CONTINUATION CONTEXT\nPrevious chunk context:\n${options.context}\n`
      : '';

    const prompt = `You are a professional audio transcription engine with advanced diarization capabilities.
${contextPrompt}
## CRITICAL INSTRUCTIONS
1. **TRANSCRIPTION**: Transcribe the audio verbatim.
2. **DIARIZATION**: Identify distinct speakers by voice characteristics.
   - Assign consistent IDs (e.g., "spk_1", "spk_2") based on unique voices.
   - If the previous chunk context indicates a speaker was speaking at the end, try to maintain that ID if the voice matches.
   - Labels should be generic ("Speaker 1", "Speaker 2") unless names are explicitly stated.
3. **TIMESTAMPS**: Precise start/end times in SECONDS (decimal).
4. **FORMAT**: Return ONLY a valid JSON array:
[{"speakerId":"spk_1","speakerLabel":"Speaker 1","text":"Text spoken...","startTime":0.0,"endTime":3.5,"languagesUsed":["en"],"nameConfidence":0.5}]`;

    const result = await withGeminiRetry(
      () =>
        model.generateContent([
          prompt,
          { fileData: { mimeType, fileUri: uploadResponse.file.uri } },
        ]),
      `Gemini Transcription chunk ${options?.chunkIndex || 0}`,
    );

    const responseText = result.response.text();
    let jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonString = arrayMatch[0];

    let segments = JSON.parse(jsonString);

    // Apply offset and cleanup
    if (options?.timestampOffset) {
      segments = segments.map((seg: any) => ({
        ...seg,
        startTime: (seg.startTime || 0) + options.timestampOffset!,
        endTime: (seg.endTime || 0) + options.timestampOffset!,
      }));
    }

    return { segments };
  }

  async enhance(
    text: string,
    options: EnhancementOptions,
  ): Promise<EnhancementResult> {
    const prompt = `You are an expert transcript editor. Your task is to improve the quality of a meeting transcript.
## CRITICAL REQUIREMENTS
1. **SMART CORRECTION**: Fix spelling, capitalization, and grammar.
2. **SPEAKER NAME DETECTION**: Suggest real names from context.
3. **OUTPUT FORMAT**: Return JSON with "corrections" and "speakerNames" arrays.

Transcript:
${text.substring(0, 30000)}`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await withGeminiRetry(
      () => model.generateContent(prompt),
      `Enhancement for meeting ${options.meetingId}`,
    );

    const responseText = result.response.text();
    const jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(jsonString);
      return {
        corrections: parsed.corrections || [],
        speakerNames: parsed.speakerNames || [],
      };
    } catch (e) {
      console.error('Failed to parse enhancement response:', e);
      return { corrections: [], speakerNames: [] };
    }
  }

  async redact(
    text: string,
    options: RedactionOptions,
  ): Promise<RedactionResult> {
    const prompt = `You are an expert data privacy officer. Your task is to redact PII (Personally Identifiable Information) from a meeting transcript.
## CRITICAL REQUIREMENTS
1. **PII DETECTION**: Identify and redact names, email addresses, phone numbers, and physical addresses.
2. **REDACTION FORMAT**: Replace redacted items with placeholders like [NAME], [EMAIL], [PHONE], [ADDRESS].
3. **PRESERVE STRUCTURE**: Return the redacted text for each segment exactly as indexed.
4. **JSON OUTPUT**: Return a JSON object with:
   - "redactedSegments": Array of {"segmentIndex": number, "redactedText": string}
   - "itemsRedacted": Total count of items removed.
   - "typesFound": Array of PII types identified.

## TRANSCRIPT TO REDACT (indexed segments):
${text.substring(0, 30000)}`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await withGeminiRetry(
      () => model.generateContent(prompt),
      `PII Redaction for meeting ${options.meetingId}`,
    );

    const responseText = result.response.text();
    const jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(jsonString);
      return {
        redactedSegments: parsed.redactedSegments || [],
        itemsRedacted: parsed.itemsRedacted || 0,
        typesFound: parsed.typesFound || [],
      };
    } catch (e) {
      console.error('Failed to parse redaction response:', e);
      return { redactedSegments: [], itemsRedacted: 0, typesFound: [] };
    }
  }
}
