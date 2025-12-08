import { Module, forwardRef } from '@nestjs/common';
import { MinutesService } from './minutes.service';
import { MinutesController } from './minutes.controller';
import { PrismaService } from '../prisma/prisma.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [MinutesController],
  providers: [MinutesService, PrismaService],
  exports: [MinutesService],
})
export class MinutesModule { }
