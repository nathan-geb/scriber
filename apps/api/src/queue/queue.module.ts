import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TranscriptionProcessor } from './transcription.processor';
import { MinutesProcessor } from './minutes.processor';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { TranscriptionsModule } from '../transcriptions/transcriptions.module';
import { MinutesModule } from '../minutes/minutes.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'transcription' }, { name: 'minutes' }),
    forwardRef(() => TranscriptionsModule),
    forwardRef(() => MinutesModule),
    EventsModule,
    PrismaModule,
    UsageModule,
  ],
  controllers: [JobsController],
  providers: [TranscriptionProcessor, MinutesProcessor, JobsService],
  exports: [BullModule, JobsService],
})
export class QueueModule { }

