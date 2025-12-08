import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';
import { JobsService } from '../queue/jobs.service';
import { EventsGateway } from '../events/events.gateway';
import { parseFile } from 'music-metadata';

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private usageService: UsageService,
    private jobsService: JobsService,
    private eventsGateway: EventsGateway,
  ) { }

  private async extractAudioDuration(filePath: string): Promise<number> {
    try {
      const metadata = await parseFile(filePath);
      const durationSeconds = Math.ceil(metadata.format.duration || 0);
      return durationSeconds > 0 ? durationSeconds : 300; // Fallback to 5 min
    } catch (error) {
      console.warn('Could not extract audio duration:', error);
      return 300; // Default 5 min estimate
    }
  }

  async handleFileUpload(
    file: Express.Multer.File,
    user: { userId: string },
    languageCode?: string,
  ) {
    // Extract actual duration from audio file
    const durationSeconds = await this.extractAudioDuration(file.path);

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
      path: file.path,
      duration: durationSeconds,
    };
  }
}

