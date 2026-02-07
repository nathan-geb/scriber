import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryContextInterceptor } from './monitoring/sentry-context.interceptor';
import { SentryModule } from '@sentry/nestjs/setup';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { TranscriptionsModule } from './transcriptions/transcriptions.module';
import { MinutesModule } from './minutes/minutes.module';
import { MeetingsModule } from './meetings/meetings.module';
import { PrismaModule } from './prisma/prisma.module';
import { ExportsModule } from './exports/exports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { TagsModule } from './tags/tags.module';
import { SpeakersModule } from './speakers/speakers.module';
import { UsageModule } from './usage/usage.module';
import { SharesModule } from './shares/shares.module';
import { EventsModule } from './events/events.module';
import { QueueModule } from './queue/queue.module';
import { CorrectionsModule } from './corrections/corrections.module';
import { SegmentsModule } from './segments/segments.module';
import { MomentsModule } from './moments/moments.module';
import { QualityModule } from './quality/quality.module';
import { TelegramModule } from './telegram/telegram.module';
import { TemplatesModule } from './templates/templates.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SearchModule } from './search/search.module';
import { BillingModule } from './billing/billing.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [
    // Configuration must be global to be used in all modules
    ConfigModule.forRoot({ isGlobal: true }),
    // Sentry must be first for proper error capturing
    SentryModule.forRoot(),
    // Rate limiting - default 100 requests per minute
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 5, // 5 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    UploadsModule,
    TranscriptionsModule,
    MinutesModule,
    MeetingsModule,
    ExportsModule,
    NotificationsModule,
    AdminModule,
    TagsModule,
    SpeakersModule,
    UsageModule,
    SharesModule,
    EventsModule,
    QueueModule,
    CorrectionsModule,
    TelegramModule,
    SegmentsModule,
    MomentsModule,
    QualityModule,
    TemplatesModule,
    SupabaseModule,
    SearchModule,
    BillingModule,
    CalendarModule,
  ],
  controllers: [],
  providers: [
    // Apply ThrottlerGuard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Apply Sentry Context Interceptor globally
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryContextInterceptor,
    },
  ],
})
export class AppModule { }
