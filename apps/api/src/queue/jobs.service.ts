import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { TranscriptionJobData } from './transcription.processor';
import { MinutesJobData } from './minutes.processor';
import { PrismaService } from '../prisma/prisma.service';

export interface JobInfo {
  id: string;
  name: string;
  state: string;
  progress: number;
  data: any;
  createdAt: Date;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('transcription') private transcriptionQueue: Queue,
    @InjectQueue('minutes') private minutesQueue: Queue,
    private prisma: PrismaService,
  ) { }

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
   * Get job status by ID
   */
  async getJobStatus(
    jobId: string,
    type: 'transcription' | 'minutes',
  ): Promise<JobInfo | null> {
    const queue =
      type === 'transcription' ? this.transcriptionQueue : this.minutesQueue;
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

    // Get active and waiting jobs from both queues
    const [
      transcriptionActive,
      transcriptionWaiting,
      minutesActive,
      minutesWaiting,
    ] = await Promise.all([
      this.transcriptionQueue.getJobs(['active']),
      this.transcriptionQueue.getJobs(['waiting']),
      this.minutesQueue.getJobs(['active']),
      this.minutesQueue.getJobs(['waiting']),
    ]);

    const allJobs = [
      ...transcriptionActive,
      ...transcriptionWaiting,
      ...minutesActive,
      ...minutesWaiting,
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
    const minutesJobs = await this.minutesQueue.getJobs(['active', 'waiting']);

    const allJobs = [...transcriptionJobs, ...minutesJobs];

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
   * Retry a failed/stuck job by re-adding it to the queue
   * Also resets the meeting status to UPLOADED
   */
  async retryJob(meetingId: string, userId: string): Promise<Job> {
    // Reset meeting status to UPLOADED to restart the pipeline
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'UPLOADED' },
    });

    // Re-add transcription job
    return this.addTranscriptionJob({ meetingId, userId });
  }

  /**
   * Cancel a job by meeting ID
   * Only allows cancellation if the job belongs to the specified user
   */
  async cancelJob(
    meetingId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Find the job in both queues
    const transcriptionJobs = await this.transcriptionQueue.getJobs([
      'active',
      'waiting',
      'delayed',
    ]);
    const minutesJobs = await this.minutesQueue.getJobs([
      'active',
      'waiting',
      'delayed',
    ]);

    const allJobs = [...transcriptionJobs, ...minutesJobs];
    const job = allJobs.find((j) => j.data.meetingId === meetingId);

    if (!job) {
      return { success: false, message: 'No active job found for this meeting' };
    }

    // Verify ownership
    if (job.data.userId !== userId) {
      return { success: false, message: 'Unauthorized to cancel this job' };
    }

    const state = await job.getState();

    // Can only cancel waiting or delayed jobs safely
    // Active jobs are already processing
    if (state === 'active') {
      // For active jobs, we can try to move them to failed state
      await job.moveToFailed(new Error('Cancelled by user'), job.token || '');
    } else {
      // Remove the job from queue
      await job.remove();
    }

    // Update meeting status to CANCELLED
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Job cancelled successfully' };
  }
}

