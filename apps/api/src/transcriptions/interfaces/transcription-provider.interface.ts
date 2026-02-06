// TranscriptSegment import removed as it's not used locally in this interface file

export interface TranscriptionResult {
  segments: Array<{
    speakerId: string;
    speakerLabel: string;
    text: string;
    startTime: number;
    endTime: number;
    languagesUsed: string[];
    nameConfidence: number;
  }>;
  qualityScore?: number;
  inaudibleCount?: number;
}

export interface TranscriptionProvider {
  name: string;
  transcribe?(
    filePath: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
  enhance?(
    text: string,
    options?: EnhancementOptions,
  ): Promise<EnhancementResult>;
  redact?(text: string, options?: RedactionOptions): Promise<RedactionResult>;
}

export interface RedactionOptions {
  meetingId: string;
}

export interface RedactionResult {
  redactedSegments: Array<{
    segmentIndex: number;
    redactedText: string;
  }>;
  itemsRedacted: number;
  typesFound: string[];
}

export interface EnhancementOptions {
  meetingId: string;
}

export interface EnhancementResult {
  corrections: Array<{
    segmentIndex: number;
    originalText: string;
    correctedText: string;
    reason: string;
  }>;
  speakerNames: Array<{
    segmentIndex: number;
    currentName: string;
    suggestedName: string;
    evidence: string;
  }>;
}

export interface TranscriptionOptions {
  language?: string;
  context?: string;
  prompt?: string;
  chunkIndex?: number;
  timestampOffset?: number;
}
