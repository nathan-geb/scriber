import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class AdminService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-01-27' as any,
      });
    }
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getStats() {
    const [
      userCount,
      meetingCount,
      completedMeetings,
      failedMeetings,
      subscriptionsByPlan,
      recentUsers,
      totalMinutesProcessed,
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
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.meeting.aggregate({
        _sum: { durationSeconds: true },
        where: { status: 'COMPLETED' },
      }),
    ]);

    const successRate =
      meetingCount > 0
        ? Math.round((completedMeetings / meetingCount) * 100)
        : 0;

    // Get plan names for subscription stats
    const plans = await this.prisma.plan.findMany();
    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    const subscriptionsWithNames = subscriptionsByPlan.map((s) => ({
      planId: s.planId,
      planName: planMap.get(s.planId) || 'Unknown',
      count: s._count.planId,
    }));

    return {
      userCount,
      meetingCount,
      completedMeetings,
      failedMeetings,
      successRate,
      newUsersLast7Days: recentUsers,
      subscriptionsByPlan: subscriptionsWithNames,
      totalMinutesProcessed: Math.round(
        (totalMinutesProcessed._sum.durationSeconds || 0) / 60,
      ),
    };
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

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

  async getUserUsageStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            plan: true,
            usage: {
              orderBy: { weekStartDate: 'desc' },
              take: 12,
            },
          },
        },
        _count: { select: { meetings: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Get meeting stats
    const meetingStats = await this.prisma.meeting.aggregate({
      where: { userId },
      _sum: { durationSeconds: true },
      _count: true,
    });

    // Get monthly usage breakdown
    const monthlyUsage = await this.prisma.meeting.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      subscription: user.subscription,
      stats: {
        totalMeetings: meetingStats._count,
        totalMinutes: Math.round(
          (meetingStats._sum.durationSeconds || 0) / 60,
        ),
        statusBreakdown: monthlyUsage,
      },
      weeklyUsage: user.subscription?.usage || [],
    };
  }

  async updateUserPlan(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.subscription.upsert({
      where: { userId },
      update: { planId, active: true },
      create: { userId, planId, active: true },
      include: { plan: true },
    });
  }

  async toggleUserStatus(userId: string, active: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot disable admin users');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: active },
    });
  }

  // ============================================
  // PLAN MANAGEMENT
  // ============================================

  async getAllPlans() {
    const plans = await this.prisma.plan.findMany({
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: { price: 'asc' },
    });

    return plans.map((plan) => ({
      ...plan,
      subscriberCount: plan._count.subscriptions,
    }));
  }

  async createPlan(data: {
    name: string;
    maxMinutesPerUpload: number;
    maxUploadsPerWeek: number;
    monthlyMinutesLimit: number;
    price: number;
    currency?: string;
  }) {
    // Check if plan name already exists
    const existing = await this.prisma.plan.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException('A plan with this name already exists');
    }

    return this.prisma.plan.create({
      data: {
        name: data.name,
        maxMinutesPerUpload: data.maxMinutesPerUpload,
        maxUploadsPerWeek: data.maxUploadsPerWeek,
        monthlyMinutesLimit: data.monthlyMinutesLimit,
        price: data.price,
        currency: data.currency || 'USD',
      },
    });
  }

  async updatePlan(
    planId: string,
    data: {
      name?: string;
      maxMinutesPerUpload?: number;
      maxUploadsPerWeek?: number;
      monthlyMinutesLimit?: number;
      price?: number;
      currency?: string;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    // Check for name conflict if changing name
    if (data.name && data.name !== plan.name) {
      const existing = await this.prisma.plan.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        throw new BadRequestException('A plan with this name already exists');
      }
    }

    return this.prisma.plan.update({
      where: { id: planId },
      data,
    });
  }

  async deletePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { _count: { select: { subscriptions: true } } },
    });

    if (!plan) throw new NotFoundException('Plan not found');

    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan with ${plan._count.subscriptions} active subscribers. Migrate them first.`,
      );
    }

    await this.prisma.plan.delete({ where: { id: planId } });
    return { deleted: true };
  }

  // ============================================
  // PAYMENT & REVENUE
  // ============================================

  async getPaymentHistory(page = 1, limit = 20) {
    if (!this.stripe) {
      return {
        payments: [],
        total: 0,
        page,
        limit,
        pageCount: 0,
        stripeConfigured: false,
      };
    }

    try {
      const charges = await this.stripe.charges.list({
        limit: limit,
        starting_after:
          page > 1 ? await this.getChargeOffset(page, limit) : undefined,
      });

      // Map charges to user info
      const payments = await Promise.all(
        charges.data.map(async (charge) => {
          let userEmail = charge.billing_details?.email || 'Unknown';
          let userName = charge.billing_details?.name || null;

          // Try to find user by email
          if (userEmail && userEmail !== 'Unknown') {
            const user = await this.prisma.user.findUnique({
              where: { email: userEmail },
              select: { id: true, name: true, email: true },
            });
            if (user) {
              userName = user.name;
            }
          }

          return {
            id: charge.id,
            amount: charge.amount / 100,
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            userEmail,
            userName,
            description: charge.description,
            createdAt: new Date(charge.created * 1000).toISOString(),
          };
        }),
      );

      return {
        payments,
        total: charges.data.length,
        page,
        limit,
        pageCount: charges.has_more ? page + 1 : page,
        stripeConfigured: true,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch payment history: ${error.message}`);
      return {
        payments: [],
        total: 0,
        page,
        limit,
        pageCount: 0,
        stripeConfigured: true,
        error: error.message,
      };
    }
  }

  private async getChargeOffset(
    page: number,
    limit: number,
  ): Promise<string | undefined> {
    if (!this.stripe || page <= 1) return undefined;

    // Fetch charges to get the offset
    const skipCount = (page - 1) * limit;
    const charges = await this.stripe.charges.list({ limit: skipCount });
    return charges.data[charges.data.length - 1]?.id;
  }

  async getRevenueStats() {
    if (!this.stripe) {
      return {
        stripeConfigured: false,
        monthlyRevenue: [],
        totalRevenue: 0,
        mrr: 0,
        subscribersByPlan: [],
      };
    }

    try {
      // Get active subscriptions count by plan
      const subscribersByPlan = await this.getAllPlans();

      // Get charges for the last 12 months
      const twelveMonthsAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
      const charges = await this.stripe.charges.list({
        created: { gte: twelveMonthsAgo },
        limit: 100,
      });

      // Group by month
      const monthlyRevenue = new Map<string, number>();
      let totalRevenue = 0;

      for (const charge of charges.data) {
        if (charge.status === 'succeeded') {
          const date = new Date(charge.created * 1000);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyRevenue.set(
            monthKey,
            (monthlyRevenue.get(monthKey) || 0) + charge.amount / 100,
          );
          totalRevenue += charge.amount / 100;
        }
      }

      // Calculate MRR from active subscriptions
      const activeSubscriptions = await this.stripe.subscriptions.list({
        status: 'active',
        limit: 100,
      });

      let mrr = 0;
      for (const sub of activeSubscriptions.data) {
        for (const item of sub.items.data) {
          if (item.price.recurring?.interval === 'month') {
            mrr += (item.price.unit_amount || 0) / 100;
          } else if (item.price.recurring?.interval === 'year') {
            mrr += (item.price.unit_amount || 0) / 100 / 12;
          }
        }
      }

      // Convert map to sorted array
      const monthlyRevenueArray = Array.from(monthlyRevenue.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        stripeConfigured: true,
        monthlyRevenue: monthlyRevenueArray,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        mrr: Math.round(mrr * 100) / 100,
        subscribersByPlan: subscribersByPlan.map((p) => ({
          planName: p.name,
          price: Number(p.price),
          subscriberCount: p.subscriberCount,
        })),
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch revenue stats: ${error.message}`);
      return {
        stripeConfigured: true,
        error: error.message,
        monthlyRevenue: [],
        totalRevenue: 0,
        mrr: 0,
        subscribersByPlan: [],
      };
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getMeetingAnalytics(period: 'day' | 'week' | 'month' = 'week') {
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
        break;
      case 'month':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 12 months
        break;
      case 'week':
      default:
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
    }

    // Get all meetings in the period
    const meetings = await this.prisma.meeting.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        durationSeconds: true,
        createdAt: true,
      },
    });

    // Group by period
    const groupedData = new Map<
      string,
      { total: number; completed: number; failed: number; minutes: number }
    >();

    for (const meeting of meetings) {
      let key: string;
      const date = new Date(meeting.createdAt);

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'week':
        default:
          // Get week number
          const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
          const weekNum = Math.ceil(
            ((date.getTime() - firstDayOfYear.getTime()) / 86400000 + 1) / 7,
          );
          key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      }

      const current = groupedData.get(key) || {
        total: 0,
        completed: 0,
        failed: 0,
        minutes: 0,
      };
      current.total++;
      if (meeting.status === 'COMPLETED') current.completed++;
      if (meeting.status === 'FAILED') current.failed++;
      current.minutes += Math.round((meeting.durationSeconds || 0) / 60);
      groupedData.set(key, current);
    }

    // Convert to sorted array
    const analytics = Array.from(groupedData.entries())
      .map(([period, data]) => ({
        period,
        ...data,
        successRate:
          data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Get top users
    const topUsers = await this.prisma.user.findMany({
      take: 10,
      orderBy: {
        meetings: { _count: 'desc' },
      },
      include: {
        _count: { select: { meetings: true } },
        subscription: { include: { plan: true } },
      },
    });

    return {
      period,
      analytics,
      topUsers: topUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        meetingCount: u._count.meetings,
        plan: u.subscription?.plan?.name || 'Free',
      })),
    };
  }
}
