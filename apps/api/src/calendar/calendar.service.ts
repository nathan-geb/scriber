import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private prisma: PrismaService) {}

  async connectGoogleCalendar(userId: string, tokens: GoogleTokens) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (this.prisma as any).calendarConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'GOOGLE',
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
        status: 'ACTIVE',
      },
      create: {
        userId,
        provider: 'GOOGLE',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
      },
    });
  }

  async syncEvents(userId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = await (this.prisma as any).calendarConnection.findUnique(
      {
        where: {
          userId_provider: {
            userId,
            provider: 'GOOGLE',
          },
        },
      },
    );

    if (!connection) {
      this.logger.warn(
        `No Google Calendar connection found for user ${userId}`,
      );
      return [];
    }

    // TODO: Implement Google Calendar API call to fetch events
    // Filter for events with meeting links
    this.logger.log(`Syncing events for user ${userId}...`);

    // placeholder returning mock events
    return [];
  }

  async listConnections(userId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (this.prisma as any).calendarConnection.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });
  }

  async disconnect(userId: string, provider: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (this.prisma as any).calendarConnection.delete({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }
}
