import { Module } from '@nestjs/common';
import { CorrectionsController } from './corrections.controller';
import { CorrectionsService } from './corrections.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsService],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
