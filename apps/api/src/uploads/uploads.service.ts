import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';
import { JobsService } from '../queue/jobs.service';
import { EventsGateway } from '../events/events.gateway';
import { parseFile } from 'music-metadata';
import { randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  readdirSync,
} from 'fs';
import { join } from 'path';

// In-memory store for active upload sessions (in production, use Redis)
interface UploadSession {
  userId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  mimeType: string;
  language?: string;
  createdAt: Date;
  tempDir: string;
}

const uploadSessions = new Map<string, UploadSession>();

// Clean up stale sessions (older than 1 hour)
setInterval(
  () => {
    const now = Date.now();
    for (const [uploadId, session] of uploadSessions.entries()) {
      if (now - session.createdAt.getTime() > 60 * 60 * 1000) {
        // Clean up temp files
        try {
          if (existsSync(session.tempDir)) {
            const files = readdirSync(session.tempDir);
            for (const file of files) {
              unlinkSync(join(session.tempDir, file));
            }
            unlinkSync(session.tempDir);
          }
        } catch (e) {
          console.warn('Failed to clean up stale upload session:', e);
        }
        uploadSessions.delete(uploadId);
      }
    }
  },
  5 * 60 * 1000,
); // Every 5 minutes

@Injectable()
export class UploadsService {
  private readonly chunksBaseDir = join(process.cwd(), 'uploads', 'chunks');

  constructor(
    private prisma: PrismaService,
    private usageService: UsageService,
    private jobsService: JobsService,
    private eventsGateway: EventsGateway,
  ) {
    // Ensure chunks directory exists
    if (!existsSync(this.chunksBaseDir)) {
      mkdirSync(this.chunksBaseDir, { recursive: true });
    }
  }

  /**
   * Extract audio duration with multiple fallback strategies:
   * 1. music-metadata (works for most formats)
   * 2. ffprobe (fallback for WebM and other edge cases, if available)
   * 3. Client-provided duration (last resort)
   */
  private async extractAudioDuration(
    filePath: string,
    clientDuration?: number,
  ): Promise<number> {
    // Try 1: music-metadata
    try {
      const metadata = await parseFile(filePath);
      const durationSeconds = Math.ceil(metadata.format.duration || 0);
      if (durationSeconds > 0) {
        return durationSeconds;
      }
    } catch (error) {
      console.warn('music-metadata failed:', error);
    }

    // Try 2: ffprobe (better for WebM files) - check if available first
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Check if ffprobe is available
      try {
        await execAsync('which ffprobe || where ffprobe 2>/dev/null');
      } catch {
        // ffprobe not installed, skip this method
        console.log('ffprobe not available, skipping');
        throw new Error('ffprobe not available');
      }

      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      );
      const duration = parseFloat(stdout.trim());
      if (!isNaN(duration) && duration > 0) {
        return Math.ceil(duration);
      }
    } catch (error) {
      // Only log if it's not the "not available" error
      if ((error as Error).message !== 'ffprobe not available') {
        console.warn('ffprobe fallback failed:', error);
      }
    }

    // Try 3: Use client-provided duration if available
    if (clientDuration && clientDuration > 0) {
      console.log(`Using client-provided duration: ${clientDuration}s`);
      return Math.ceil(clientDuration);
    }

    // Final fallback: estimate 5 minutes
    console.warn('All duration extraction methods failed, using 300s default');
    return 300;
  }


  async handleFileUpload(
    file: Express.Multer.File,
    user: { userId: string },
    languageCode?: string,
    clientDuration?: number,
  ) {
    // Extract actual duration from audio file (with client fallback for WebM)
    const durationSeconds = await this.extractAudioDuration(
      file.path,
      clientDuration,
    );

    // Check usage limits before proceeding
    await this.usageService.enforceUploadLimit(user.userId, durationSeconds);

    // Create a Meeting record
    const meeting = await this.prisma.meeting.create({
      data: {
        userId: user.userId,
        title: file.originalname,
        fileUrl: file.path,
        originalFileName: file.originalname,
        status: 'UPLOADED',
        durationSeconds: durationSeconds,
        languageCode: languageCode || 'en',
      },
    });

    // Emit pipeline step: upload complete
    this.eventsGateway.emitPipelineStep(user.userId, meeting.id, {
      step: 'upload',
      status: 'completed',
      progress: 100,
    });

    // Increment usage after successful creation
    await this.usageService.incrementUsage(user.userId, durationSeconds);

    // Auto-start transcription job
    const job = await this.jobsService.addTranscriptionJob({
      meetingId: meeting.id,
      userId: user.userId,
    });

    // Emit pipeline step: transcription queued
    this.eventsGateway.emitPipelineStep(user.userId, meeting.id, {
      step: 'transcription',
      status: 'queued',
      progress: 0,
    });

    return {
      message: 'File uploaded and transcription started',
      meetingId: meeting.id,
      jobId: job.id,
      duration: durationSeconds,
    };
  }

  /**
   * Initiate a chunked upload session
   */
  async initiateChunkedUpload(
    userId: string,
    filename: string,
    totalSize: number,
    totalChunks: number,
    mimeType: string,
    language?: string,
  ): Promise<{ uploadId: string; chunkSize: number }> {
    const uploadId = randomUUID();
    const tempDir = join(this.chunksBaseDir, uploadId);

    // Create temp directory for this upload
    mkdirSync(tempDir, { recursive: true });

    const session: UploadSession = {
      userId,
      filename,
      totalSize,
      totalChunks,
      receivedChunks: new Set(),
      mimeType,
      language,
      createdAt: new Date(),
      tempDir,
    };

    uploadSessions.set(uploadId, session);

    // Recommended chunk size (5MB default)
    const chunkSize = Math.ceil(totalSize / totalChunks);

    return {
      uploadId,
      chunkSize,
    };
  }

  /**
   * Store a single chunk
   */
  async storeChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer,
    userId: string,
  ): Promise<{ received: number; total: number; complete: boolean }> {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    if (session.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new BadRequestException(`Invalid chunk index: ${chunkIndex}`);
    }

    // Write chunk to temp file
    const chunkPath = join(
      session.tempDir,
      `chunk_${chunkIndex.toString().padStart(5, '0')}`,
    );
    writeFileSync(chunkPath, chunkData);

    session.receivedChunks.add(chunkIndex);

    const received = session.receivedChunks.size;
    const complete = received === session.totalChunks;

    return {
      received,
      total: session.totalChunks,
      complete,
    };
  }

  /**
   * Complete the chunked upload - reassemble and process
   */
  async completeChunkedUpload(
    uploadId: string,
    userId: string,
    language?: string,
  ): Promise<{ meetingId: string; jobId: string }> {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    if (session.userId !== userId) {
      throw new BadRequestException('Unauthorized access to upload session');
    }

    if (session.receivedChunks.size !== session.totalChunks) {
      throw new BadRequestException(
        `Missing chunks: received ${session.receivedChunks.size}/${session.totalChunks}`,
      );
    }

    // Reassemble chunks into final file
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const finalFilename = `${Date.now()}_${session.filename}`;
    const finalPath = join(uploadsDir, finalFilename);

    // Read and concatenate all chunks in order
    const chunks: Buffer[] = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = join(
        session.tempDir,
        `chunk_${i.toString().padStart(5, '0')}`,
      );
      if (!existsSync(chunkPath)) {
        throw new BadRequestException(`Chunk ${i} is missing`);
      }
      chunks.push(readFileSync(chunkPath));
    }

    // Write final file
    const finalBuffer = Buffer.concat(chunks);
    writeFileSync(finalPath, finalBuffer);

    // Clean up temp chunks
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = join(
        session.tempDir,
        `chunk_${i.toString().padStart(5, '0')}`,
      );
      try {
        unlinkSync(chunkPath);
      } catch (e) {
        console.warn('Failed to delete chunk:', e);
      }
    }
    try {
      unlinkSync(session.tempDir);
    } catch (e) {
      console.warn('Failed to delete temp dir:', e);
    }

    // Remove session
    uploadSessions.delete(uploadId);

    // Extract duration
    const durationSeconds = await this.extractAudioDuration(finalPath);

    // Check usage limits
    await this.usageService.enforceUploadLimit(userId, durationSeconds);

    // Create meeting record
    const meeting = await this.prisma.meeting.create({
      data: {
        userId,
        title: session.filename,
        fileUrl: finalPath,
        originalFileName: session.filename,
        status: 'UPLOADED',
        durationSeconds,
        languageCode: language || session.language || 'en',
      },
    });

    // Emit pipeline step: upload complete
    this.eventsGateway.emitPipelineStep(userId, meeting.id, {
      step: 'upload',
      status: 'completed',
      progress: 100,
    });

    // Increment usage
    await this.usageService.incrementUsage(userId, durationSeconds);

    // Start transcription job
    const job = await this.jobsService.addTranscriptionJob({
      meetingId: meeting.id,
      userId,
    });

    // Emit pipeline step: transcription queued
    this.eventsGateway.emitPipelineStep(userId, meeting.id, {
      step: 'transcription',
      status: 'queued',
      progress: 0,
    });

    return {
      meetingId: meeting.id,
      jobId: job.id!,
    };
  }

  /**
   * Get upload session status
   */
  getUploadStatus(
    uploadId: string,
    userId: string,
  ): {
    uploadId: string;
    received: number;
    total: number;
    complete: boolean;
  } | null {
    const session = uploadSessions.get(uploadId);

    if (!session || session.userId !== userId) {
      return null;
    }

    return {
      uploadId,
      received: session.receivedChunks.size,
      total: session.totalChunks,
      complete: session.receivedChunks.size === session.totalChunks,
    };
  }
}
