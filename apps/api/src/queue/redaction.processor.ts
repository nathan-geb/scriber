import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TranscriptionsService } from '../transcriptions/transcriptions.service';
import { EventsGateway } from '../events/events.gateway';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

export interface RedactionJobData {
  meetingId: string;
  userId: string;
  skipMinutesGeneration?: boolean;
}

@Injectable()
@Processor('redaction')
export class RedactionProcessor extends WorkerHost {
  constructor(
    private readonly transcriptionsService: TranscriptionsService,
    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<RedactionJobData>): Promise<any> {
    const { meetingId, userId, skipMinutesGeneration } = job.data;

    // Update meeting status
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'REDACTING' },
    });

    // Emit pipeline step: redaction started
    this.eventsGateway.emitPipelineStep(userId, meetingId, {
      step: 'redaction',
      status: 'processing',
      progress: 0,
    });

    try {
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'redaction',
        status: 'processing',
        progress: 20,
      });

      const result = await this.transcriptionsService.redactTranscript(
        meetingId,
        userId,
        true,
      );

      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'redaction',
        status: 'completed',
        progress: 100,
      });

      // After redaction, trigger minutes generation
      if (!skipMinutesGeneration) {
        this.eventsGateway.emitPipelineStep(userId, meetingId, {
          step: 'minutes',
          status: 'queued',
          progress: 0,
        });

        await this.jobsService.addMinutesJob({
          meetingId,
          userId,
        });
      }

      return result;
    } catch (error) {
      console.error(`Redaction job failed for meeting ${meetingId}:`, error);

      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'redaction',
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RedactionJobData>) {
    console.log(
      `Redaction job ${job.id} completed for meeting ${job.data.meetingId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RedactionJobData>, error: Error) {
    console.error(`Redaction job ${job.id} failed:`, error.message);
  }
}
