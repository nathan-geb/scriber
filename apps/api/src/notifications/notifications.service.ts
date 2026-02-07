import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private transporter;
  private expo: Expo;

  constructor(private prisma: PrismaService) {
    // Initialize Nodemailer (Mock if no env vars)
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.warn(
        'SMTP_HOST not set. Email notifications will be logged only.',
      );
    }

    // Initialize Expo
    this.expo = new Expo();
  }

  async sendEmail(userId: string, subject: string, text: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    });

    if (
      !user ||
      (user.notificationSettings && !user.notificationSettings.email)
    ) {
      return;
    }

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: '"Scriber" <no-reply@scriber.app>',
          to: user.email,
          subject,
          text,
        });
        console.log(`Email sent to ${user.email}`);
      } catch (error) {
        console.error('Failed to send email:', error);
      }
    } else {
      console.log(
        `[MOCK EMAIL] To: ${user.email}, Subject: ${subject}, Body: ${text}`,
      );
    }
  }

  async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: { meetingId?: string; type?: string; action?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    });

    if (
      !user ||
      !user.notificationSettings ||
      !user.notificationSettings.push ||
      !user.notificationSettings.deviceToken
    ) {
      return;
    }

    const pushToken = user.notificationSettings.deviceToken;

    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return;
    }

    const messages = [
      {
        to: pushToken,
        sound: 'default' as const,
        title,
        body,
        data: data || {},
      },
    ];

    try {
      await this.expo.sendPushNotificationsAsync(messages as any);
      console.log(`Push sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send push:', error);
    }
  }

  // In-App Notification Methods

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    meetingId?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        meetingId,
      },
    });
  }

  async getUserNotifications(userId: string, limit = 50, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }
}
