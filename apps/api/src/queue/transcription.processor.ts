import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TranscriptionsService } from '../transcriptions/transcriptions.service';
import { EventsGateway } from '../events/events.gateway';
import { JobsService } from './jobs.service';

export interface TranscriptionJobData {
  meetingId: string;
  userId: string;
  skipMinutesGeneration?: boolean; // Optional: allow skipping auto-minutes for manual control
}

@Injectable()
@Processor('transcription')
export class TranscriptionProcessor extends WorkerHost {
  constructor(
    private readonly transcriptionsService: TranscriptionsService,
    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job<TranscriptionJobData>): Promise<any> {
    const { meetingId, userId, skipMinutesGeneration } = job.data;

    // Emit pipeline step: transcription started
    this.eventsGateway.emitPipelineStep(userId, meetingId, {
      step: 'transcription',
      status: 'processing',
      progress: 0,
    });

    try {
      // Emit progress: uploading to AI
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'transcription',
        status: 'uploading',
        progress: 20,
      });

      const result = await this.transcriptionsService.transcribe(meetingId);

      // Emit progress: transcription complete
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'transcription',
        status: 'completed',
        progress: 100,
      });

      // Auto-trigger minutes generation unless explicitly skipped
      if (!skipMinutesGeneration) {
        // Emit pipeline step: minutes starting
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
      // Emit progress: failed
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'transcription',
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<TranscriptionJobData>) {
    console.log(
      `Transcription job ${job.id} completed for meeting ${job.data.meetingId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<TranscriptionJobData>, error: Error) {
    console.error(`Transcription job ${job.id} failed:`, error.message);
  }
}
