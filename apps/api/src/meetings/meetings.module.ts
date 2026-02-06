import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { CacheModule } from '../common/cache/cache.module';

@Module({
  imports: [QueueModule, StorageModule, CacheModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, PrismaService],
})
export class MeetingsModule {}
