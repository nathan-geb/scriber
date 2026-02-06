import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranscriptionsService } from '../transcriptions/transcriptions.service';
import { JobsService } from './jobs.service';
import { EventsGateway } from '../events/events.gateway';

export interface EnhancementJobData {
  meetingId: string;
  userId: string;
}

@Injectable()
@Processor('enhancement')
export class EnhancementProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptionsService: TranscriptionsService,
    private readonly jobsService: JobsService,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<EnhancementJobData>): Promise<any> {
    const { meetingId, userId } = job.data;

    try {
      // Update meeting status
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'ENHANCING' },
      });

      // Emit pipeline progress
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'enhancement',
        status: 'processing',
      });

      // Perform enhancement
      const result = await this.transcriptionsService.enhanceTranscript(
        meetingId,
        userId,
        true,
      );

      // Check if autoRedact is enabled for the organization
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { organization: true },
      });

      if (meeting?.organization?.autoRedact) {
        // Trigger Redaction
        await this.jobsService.addRedactionJob({ meetingId, userId });
        this.eventsGateway.emitPipelineStep(userId, meetingId, {
          step: 'redaction',
          status: 'queued',
        });
      } else {
        // Trigger Minutes directly
        await this.jobsService.addMinutesJob({
          meetingId,
          userId,
          template: 'EXECUTIVE',
        });
        this.eventsGateway.emitPipelineStep(userId, meetingId, {
          step: 'minutes',
          status: 'queued',
        });
      }

      return result;
    } catch (error) {
      console.error(`Enhancement failed for meeting ${meetingId}:`, error);

      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Enhancement job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Enhancement job ${job.id} failed:`, error.message);
  }
}
