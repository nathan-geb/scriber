import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TranscriptionProcessor } from './transcription.processor';
import { MinutesProcessor } from './minutes.processor';
import { EnhancementProcessor } from './enhancement.processor';
import { RedactionProcessor } from './redaction.processor';
import { CleanupProcessor } from './cleanup.processor';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { TranscriptionsModule } from '../transcriptions/transcriptions.module';
import { MinutesModule } from '../minutes/minutes.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsageModule } from '../usage/usage.module';
import { SpeakersModule } from '../speakers/speakers.module';
import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue(
      { name: 'transcription' },
      { name: 'minutes' },
      { name: 'enhancement' },
      { name: 'redaction' },
      { name: 'cleanup' },
    ),
    forwardRef(() => TranscriptionsModule),
    forwardRef(() => MinutesModule),
    EventsModule,
    PrismaModule,
    UsageModule,
    SpeakersModule,
    BillingModule,
    StorageModule,
  ],
  controllers: [JobsController],
  providers: [
    TranscriptionProcessor,
    MinutesProcessor,
    EnhancementProcessor,
    RedactionProcessor,
    CleanupProcessor,
    JobsService,
  ],
  exports: [BullModule, JobsService],
})
export class QueueModule { }
