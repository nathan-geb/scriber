import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { TranscriptionJobData } from './transcription.processor';
import { MinutesJobData } from './minutes.processor';
import { EnhancementJobData } from './enhancement.processor';
import { RedactionJobData } from './redaction.processor';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface JobInfo {
  id: string;
  name: string;
  state: string;
  progress: number;
  data: any;
  createdAt: Date;
}

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectQueue('transcription') private transcriptionQueue: Queue,
    @InjectQueue('minutes') private minutesQueue: Queue,
    @InjectQueue('enhancement') private enhancementQueue: Queue,
    @InjectQueue('redaction') private redactionQueue: Queue,
    @InjectQueue('cleanup') private cleanupQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Schedule cleanup job to run every day at midnight
    await this.cleanupQueue.add(
      'daily-cleanup',
      {},
      {
        repeat: {
          pattern: '0 0 * * *', // Every night at midnight
        },
        jobId: 'daily-retention-cleanup', // Ensure only one instance exists
      },
    );
  }

  /**
   * Add a transcription job to the queue
   */
  async addTranscriptionJob(data: TranscriptionJobData): Promise<Job> {
    return this.transcriptionQueue.add('transcribe', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * Add an enhancement job to the queue
   */
  async addEnhancementJob(data: EnhancementJobData): Promise<Job> {
    return this.enhancementQueue.add('enhance', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * Add a minutes generation job to the queue
   */
  async addMinutesJob(data: MinutesJobData): Promise<Job> {
    return this.minutesQueue.add('generate', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * Add a redaction job to the queue
   */
  async addRedactionJob(data: RedactionJobData): Promise<Job> {
    return this.redactionQueue.add('redact', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(
    jobId: string,
    type: 'transcription' | 'minutes' | 'enhancement' | 'redaction',
  ): Promise<JobInfo | null> {
    let queue: Queue;
    if (type === 'transcription') queue = this.transcriptionQueue;
    else if (type === 'minutes') queue = this.minutesQueue;
    else if (type === 'enhancement') queue = this.enhancementQueue;
    else queue = this.redactionQueue;

    const job = await queue.getJob(jobId);

    if (!job) return null;

    const state = await job.getState();

    return {
      id: job.id!,
      name: job.name,
      state,
      progress: (job.progress as number) || 0,
      data: job.data,
      createdAt: new Date(job.timestamp),
    };
  }

  /**
   * Get all active jobs for a user
   */
  async getUserActiveJobs(userId: string): Promise<JobInfo[]> {
    const jobs: JobInfo[] = [];

    // Get active and waiting jobs from all queues
    const [
      transcriptionActive,
      transcriptionWaiting,
      enhancementActive,
      enhancementWaiting,
      minutesActive,
      minutesWaiting,
      redactionActive,
      redactionWaiting,
    ] = await Promise.all([
      this.transcriptionQueue.getJobs(['active']),
      this.transcriptionQueue.getJobs(['waiting']),
      this.enhancementQueue.getJobs(['active']),
      this.enhancementQueue.getJobs(['waiting']),
      this.minutesQueue.getJobs(['active']),
      this.minutesQueue.getJobs(['waiting']),
      this.redactionQueue.getJobs(['active']),
      this.redactionQueue.getJobs(['waiting']),
    ]);

    const allJobs = [
      ...transcriptionActive,
      ...transcriptionWaiting,
      ...enhancementActive,
      ...enhancementWaiting,
      ...minutesActive,
      ...minutesWaiting,
      ...redactionActive,
      ...redactionWaiting,
    ];

    for (const job of allJobs) {
      if (job.data.userId === userId) {
        const state = await job.getState();
        jobs.push({
          id: job.id!,
          name: job.name,
          state,
          progress: (job.progress as number) || 0,
          data: job.data,
          createdAt: new Date(job.timestamp),
        });
      }
    }

    return jobs;
  }

  /**
   * Get active job for a meeting
   */
  async getJobByMeetingId(meetingId: string): Promise<JobInfo | null> {
    const transcriptionJobs = await this.transcriptionQueue.getJobs([
      'active',
      'waiting',
    ]);
    const enhancementJobs = await this.enhancementQueue.getJobs([
      'active',
      'waiting',
    ]);
    const minutesJobs = await this.minutesQueue.getJobs(['active', 'waiting']);
    const redactionJobs = await this.redactionQueue.getJobs([
      'active',
      'waiting',
    ]);

    const allJobs = [
      ...transcriptionJobs,
      ...enhancementJobs,
      ...minutesJobs,
      ...redactionJobs,
    ];

    const job = allJobs.find((j) => j.data.meetingId === meetingId);

    if (!job) return null;

    const state = await job.getState();

    return {
      id: job.id!,
      name: job.name,
      state,
      progress: (job.progress as number) || 0,
      data: job.data,
      createdAt: new Date(job.timestamp),
    };
  }

  /**
   * Retry a failed/stuck job
   */
  async retryJob(
    meetingId: string,
    userId: string,
  ): Promise<Job | { success: boolean; message: string }> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: { take: 1 },
        minutes: true,
      },
    });

    if (!meeting) {
      return { success: false, message: 'Meeting not found' };
    }

    const hasTranscript = meeting.transcript && meeting.transcript.length > 0;
    const hasMinutes = meeting.minutes !== null;

    if (hasTranscript && !hasMinutes) {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'TRANSCRIPT_READY',
          lastProcessedAt: new Date(),
        },
      });
      return this.addMinutesJob({
        meetingId,
        userId,
        template: 'EXECUTIVE',
      });
    }

    if (hasTranscript && hasMinutes) {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
      });
      return {
        success: true,
        message: 'Meeting was already complete, status fixed',
      };
    }

    if (meeting.fileUrl) {
      let filePath = meeting.fileUrl;
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(process.cwd(), filePath);
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, message: 'FILE_MISSING' };
      }
    } else {
      return { success: false, message: 'FILE_MISSING' };
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'UPLOADED',
        lastProcessedAt: new Date(),
      },
    });

    return this.addTranscriptionJob({ meetingId, userId });
  }

  /**
   * Cancel a job by meeting ID
   */
  async cancelJob(
    meetingId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const [transcriptionJobs, enhancementJobs, minutesJobs, redactionJobs] =
      await Promise.all([
        this.transcriptionQueue.getJobs(['active', 'waiting', 'delayed']),
        this.enhancementQueue.getJobs(['active', 'waiting', 'delayed']),
        this.minutesQueue.getJobs(['active', 'waiting', 'delayed']),
        this.redactionQueue.getJobs(['active', 'waiting', 'delayed']),
      ]);

    const allJobs = [
      ...transcriptionJobs,
      ...enhancementJobs,
      ...minutesJobs,
      ...redactionJobs,
    ];
    const job = allJobs.find((j) => j.data.meetingId === meetingId);

    if (!job) {
      return {
        success: false,
        message: 'No active job found for this meeting',
      };
    }

    if (job.data.userId !== userId) {
      return { success: false, message: 'Unauthorized to cancel this job' };
    }

    const state = await job.getState();

    if (state === 'active') {
      await job.moveToFailed(new Error('Cancelled by user'), job.token || '');
    } else {
      await job.remove();
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Job cancelled successfully' };
  }
}
