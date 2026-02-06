import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TranscriptionsService } from '../transcriptions/transcriptions.service';
import { EventsGateway } from '../events/events.gateway';
import { JobsService } from './jobs.service';
import { UsageService } from '../usage/usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpeakerIdentifierService } from '../speakers/speaker-identifier.service';
import { BillingService } from '../billing/billing.service';

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
    private readonly usageService: UsageService,
    private readonly prisma: PrismaService,
    private readonly speakerIdentifier: SpeakerIdentifierService,
    private readonly billingService: BillingService,
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

      // Emit progress: identifying speakers
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'transcription',
        status: 'processing',
        progress: 90,
      });

      // Auto-identify speaker names from context (non-blocking)
      try {
        const identified =
          await this.speakerIdentifier.identifyFromContext(meetingId);
        if (identified.length > 0) {
          console.log(
            `Identified ${identified.length} speakers for meeting ${meetingId}:`,
            identified.map((s) => `${s.originalName} → ${s.suggestedName}`),
          );
        }
      } catch (speakerError) {
        // Don't fail pipeline on speaker identification error
        console.error(
          'Speaker identification failed (non-critical):',
          speakerError,
        );
      }

      // Update lastProcessedAt timestamp for ordering
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { lastProcessedAt: new Date() },
      });

      // Emit progress: transcription complete
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'transcription',
        status: 'completed',
        progress: 100,
      });

      // Auto-trigger enhancement generation unless explicitly skipped
      if (!skipMinutesGeneration) {
        // Emit pipeline step: enhancement starting
        this.eventsGateway.emitPipelineStep(userId, meetingId, {
          step: 'enhancement',
          status: 'queued',
          progress: 0,
        });

        await this.jobsService.addEnhancementJob({
          meetingId,
          userId,
        });
      }

      // Report metered usage to Stripe if subscription is active
      try {
        const durationMinutes =
          Math.ceil((job as any).durationSeconds / 60) || 1;
        await this.billingService.reportUsage(userId, durationMinutes);
      } catch (usageReportError) {
        console.error(
          'Failed to report usage to Stripe (non-critical):',
          usageReportError,
        );
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

      // Refund usage quota on failure
      try {
        const meeting = await this.prisma.meeting.findUnique({
          where: { id: meetingId },
          select: { durationSeconds: true },
        });
        if (meeting?.durationSeconds) {
          await this.usageService.decrementUsage(
            userId,
            meeting.durationSeconds,
          );
        }
      } catch (usageError) {
        console.error(
          'Failed to decrement usage on transcription failure:',
          usageError,
        );
      }

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
