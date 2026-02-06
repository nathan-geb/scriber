import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '../generated/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findOne(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { notificationSettings: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        notificationSettings: true,
        memberships: {
          include: { organization: true },
        },
      },
    });
  }

  async findWithMemberships(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });
  }

  async updateNotificationSettings(
    userId: string,
    settings: { email?: boolean; push?: boolean },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        email: settings.email ?? true,
        push: settings.push ?? true,
      },
      update: {
        ...settings,
      },
    });
  }

  async setPushToken(userId: string, token: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        deviceToken: token,
        push: true,
        email: true,
      },
      update: {
        deviceToken: token,
        push: true,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async createWithPlan(email: string, passwordHash: string): Promise<User> {
    // Determine default plan (Free)
    const freePlan = await this.prisma.plan.findUnique({
      where: { name: 'Free' },
    });
    if (!freePlan) throw new Error('Default plan not found');

    const displayName = email.split('@')[0];

    return this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        subscription: {
          create: {
            planId: freePlan.id,
          },
        },
        notificationSettings: {
          create: {
            email: true,
            push: true,
          },
        },
        memberships: {
          create: {
            role: 'OWNER',
            organization: {
              create: {
                name: `${displayName}'s Space`,
                slug: `${displayName}-${Date.now()}`,
                isPersonal: true,
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subscription: { include: { plan: true } } },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async createOrUpdateGoogleUser(email: string, name: string): Promise<User> {
    // ... existing implementation
    return {} as any; // placeholder for view context
  }

  async generateTelegramLinkCode(userId: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { telegramLinkCode: code },
    });
    return code;
  }
}
