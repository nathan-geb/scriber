import { Module, forwardRef } from '@nestjs/common';
import { MinutesService } from './minutes.service';
import { MinutesController } from './minutes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [forwardRef(() => QueueModule), EventsModule, PrismaModule],
  controllers: [MinutesController],
  providers: [MinutesService],
  exports: [MinutesService],
})
export class MinutesModule { }
