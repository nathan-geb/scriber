import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

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
      include: { notificationSettings: true },
    });
  }

  async updateNotificationSettings(userId: string, settings: { email?: boolean; push?: boolean }) {
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
      },
    });
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subscription: { include: { plan: true } } }
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive }
    });
  }
}
