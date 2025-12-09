import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  usage: {
    uploadsThisWeek: number;
    minutesThisWeek: number;
    maxUploadsPerWeek: number;
    maxMinutesPerUpload: number;
    monthlyMinutesLimit: number;
  };
}

@Injectable()
export class UsageService {
  constructor(private prisma: PrismaService) { }

  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  async getUserUsage(userId: string): Promise<UsageCheckResult['usage']> {
    // Check if user is admin - admins have no limits
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') {
      // Admins have unlimited usage
      return {
        uploadsThisWeek: 0,
        minutesThisWeek: 0,
        maxUploadsPerWeek: Infinity,
        maxMinutesPerUpload: Infinity,
        monthlyMinutesLimit: Infinity,
      };
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      // No subscription - calculate actual usage from meetings this week
      const weekStart = this.getWeekStart();
      const actualMeetings = await this.prisma.meeting.findMany({
        where: {
          userId,
          createdAt: { gte: weekStart },
        },
        select: { durationSeconds: true },
      });

      const uploadsThisWeek = actualMeetings.length;
      const minutesThisWeek = actualMeetings.reduce(
        (sum, m) => sum + Math.ceil((m.durationSeconds || 0) / 60),
        0,
      );

      // Default free plan limits
      return {
        uploadsThisWeek,
        minutesThisWeek,
        maxUploadsPerWeek: 1,
        maxMinutesPerUpload: 5,
        monthlyMinutesLimit: 60,
      };
    }

    const weekStart = this.getWeekStart();

    // Get or create weekly usage record
    let weeklyUsage = await this.prisma.weeklyUsage.findFirst({
      where: {
        subscriptionId: subscription.id,
        weekStartDate: weekStart,
      },
    });

    if (!weeklyUsage) {
      weeklyUsage = await this.prisma.weeklyUsage.create({
        data: {
          subscriptionId: subscription.id,
          weekStartDate: weekStart,
          uploadCount: 0,
          minutesProcessed: 0,
        },
      });
    }

    return {
      uploadsThisWeek: weeklyUsage.uploadCount,
      minutesThisWeek: weeklyUsage.minutesProcessed,
      maxUploadsPerWeek: subscription.plan.maxUploadsPerWeek,
      maxMinutesPerUpload: subscription.plan.maxMinutesPerUpload,
      monthlyMinutesLimit: subscription.plan.monthlyMinutesLimit,
    };
  }

  async checkUploadAllowed(
    userId: string,
    durationSeconds: number,
  ): Promise<UsageCheckResult> {
    // getUserUsage already handles admin bypass
    const usage = await this.getUserUsage(userId);

    // If Infinity limits, user is admin - allow without checks
    if (usage.maxUploadsPerWeek === Infinity) {
      return { allowed: true, usage };
    }
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // Check uploads per week
    if (usage.uploadsThisWeek >= usage.maxUploadsPerWeek) {
      return {
        allowed: false,
        reason: `Weekly upload limit reached (${usage.maxUploadsPerWeek} per week)`,
        usage,
      };
    }

    // Check max minutes per upload
    if (durationMinutes > usage.maxMinutesPerUpload) {
      return {
        allowed: false,
        reason: `File too long (max ${usage.maxMinutesPerUpload} minutes per upload)`,
        usage,
      };
    }

    return { allowed: true, usage };
  }

  async incrementUsage(userId: string, durationSeconds: number): Promise<void> {
    // Check if user is admin - don't track admin usage
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return;

    const weekStart = this.getWeekStart();
    const durationMinutes = Math.ceil(durationSeconds / 60);

    await this.prisma.weeklyUsage.upsert({
      where: {
        subscriptionId_weekStartDate: {
          subscriptionId: subscription.id,
          weekStartDate: weekStart,
        },
      },
      update: {
        uploadCount: { increment: 1 },
        minutesProcessed: { increment: durationMinutes },
      },
      create: {
        subscriptionId: subscription.id,
        weekStartDate: weekStart,
        uploadCount: 1,
        minutesProcessed: durationMinutes,
      },
    });
  }

  async enforceUploadLimit(
    userId: string,
    durationSeconds: number,
  ): Promise<void> {
    const result = await this.checkUploadAllowed(userId, durationSeconds);
    if (!result.allowed) {
      throw new ForbiddenException(result.reason);
    }
  }

  /**
   * Decrement usage when a transcription fails.
   * This refunds the user's quota for failed jobs.
   */
  async decrementUsage(userId: string, durationSeconds: number): Promise<void> {
    // Check if user is admin - admins don't have tracked usage
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return;

    const weekStart = this.getWeekStart();
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // Only decrement if there's usage to decrement
    const existingUsage = await this.prisma.weeklyUsage.findFirst({
      where: {
        subscriptionId: subscription.id,
        weekStartDate: weekStart,
      },
    });

    if (existingUsage && existingUsage.uploadCount > 0) {
      await this.prisma.weeklyUsage.update({
        where: { id: existingUsage.id },
        data: {
          uploadCount: { decrement: 1 },
          minutesProcessed: {
            decrement: Math.min(durationMinutes, existingUsage.minutesProcessed),
          },
        },
      });
    }
  }
}
