import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) { }

  async getStats() {
    const [
      userCount,
      meetingCount,
      completedMeetings,
      failedMeetings,
      subscriptionsByPlan,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.meeting.count(),
      this.prisma.meeting.count({ where: { status: 'COMPLETED' } }),
      this.prisma.meeting.count({ where: { status: 'FAILED' } }),
      this.prisma.subscription.groupBy({
        by: ['planId'],
        _count: { planId: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
          },
        },
      }),
    ]);

    const successRate =
      meetingCount > 0
        ? Math.round((completedMeetings / meetingCount) * 100)
        : 0;

    return {
      userCount,
      meetingCount,
      completedMeetings,
      failedMeetings,
      successRate,
      newUsersLast7Days: recentUsers,
      subscriptionsByPlan,
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { meetings: true },
          },
          subscription: {
            include: { plan: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const pageCount = Math.ceil(total / limit);

    return { users, total, page, limit, pageCount };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: { include: { plan: true, usage: true } },
        meetings: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { meetings: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserPlan(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.subscription.upsert({
      where: { userId },
      update: { planId },
      create: { userId, planId },
      include: { plan: true },
    });
  }

  async toggleUserStatus(userId: string, active: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN') {
      throw new Error('Cannot disable admin users');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: active },
    });
  }
}
