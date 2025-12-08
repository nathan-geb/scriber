import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { MinutesService, MinutesTemplate } from '../minutes/minutes.service';
import { EventsGateway } from '../events/events.gateway';

export interface MinutesJobData {
  meetingId: string;
  userId: string;
  template?: MinutesTemplate;
}

@Injectable()
@Processor('minutes')
export class MinutesProcessor extends WorkerHost {
  constructor(
    private readonly minutesService: MinutesService,
    private readonly eventsGateway: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<MinutesJobData>): Promise<any> {
    const { meetingId, userId, template } = job.data;

    // Emit pipeline step: minutes processing started
    this.eventsGateway.emitPipelineStep(userId, meetingId, {
      step: 'minutes',
      status: 'processing',
      progress: 0,
    });

    try {
      // Emit pipeline step: generating
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'minutes',
        status: 'generating',
        progress: 50,
      });

      const result = await this.minutesService.generateMinutes(
        meetingId,
        template,
      );

      // Emit pipeline step: minutes complete
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'minutes',
        status: 'completed',
        progress: 100,
      });

      // Emit pipeline complete event - entire pipeline finished successfully
      this.eventsGateway.emitPipelineComplete(userId, meetingId, {
        success: true,
      });

      return result;
    } catch (error) {
      // Emit pipeline step: failed
      this.eventsGateway.emitPipelineStep(userId, meetingId, {
        step: 'minutes',
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Emit pipeline complete with failure
      this.eventsGateway.emitPipelineComplete(userId, meetingId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MinutesJobData>) {
    console.log(
      `Minutes job ${job.id} completed for meeting ${job.data.meetingId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MinutesJobData>, error: Error) {
    console.error(`Minutes job ${job.id} failed:`, error.message);
  }
}
