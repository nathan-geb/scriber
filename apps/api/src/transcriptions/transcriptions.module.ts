import { Module, forwardRef } from '@nestjs/common';
import { TranscriptionsService } from './transcriptions.service';
import { TranscriptionsController } from './transcriptions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [NotificationsModule, forwardRef(() => QueueModule), StorageModule],
  controllers: [TranscriptionsController],
  providers: [
    TranscriptionsService,
    GeminiProvider,
    {
      provide: 'TRANSCRIPTION_PROVIDER',
      useClass: GeminiProvider, // Defaults to Gemini, but easy to switch
    },
  ],
  exports: [TranscriptionsService],
})
export class TranscriptionsModule {}
