import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('STORAGE_PROVIDER') private readonly storageProvider: any,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    console.log('Starting data retention cleanup job...');

    // 1. Get all organizations with retentionDays set
    const organizations = await (this.prisma.organization as any).findMany({
      where: {
        retentionDays: {
          not: null,
        },
      },
      select: {
        id: true,
        retentionDays: true,
      },
    });

    let totalDeleted = 0;

    for (const org of organizations) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - org.retentionDays);

      // 2. Find meetings for this organization older than cutoff
      // We only delete meetings that are "COMPLETED", "FAILED", or "CANCELLED"
      const oldMeetings = await this.prisma.meeting.findMany({
        where: {
          organizationId: org.id,
          createdAt: {
            lt: cutoffDate,
          },
          status: {
            in: ['COMPLETED', 'FAILED', 'CANCELLED'] as any,
          },
        },
        include: {
          transcript: true,
          minutes: true,
        },
      });

      for (const meeting of oldMeetings) {
        // 3. Delete files from storage
        if (meeting.fileUrl) {
          try {
            await this.storageProvider.deleteFile(meeting.fileUrl);
          } catch (e) {
            console.error(
              `Failed to delete file for meeting ${meeting.id}:`,
              e,
            );
          }
        }

        // 4. Delete database records
        await this.prisma.meeting.delete({
          where: { id: meeting.id },
        });

        totalDeleted++;
      }
    }

    console.log(`Cleanup job finished. Deleted ${totalDeleted} meetings.`);
    return { totalDeleted };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Cleanup job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Cleanup job ${job.id} failed:`, error.message);
  }
}
