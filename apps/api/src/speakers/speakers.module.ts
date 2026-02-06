import { Module } from '@nestjs/common';
import { SpeakersController } from './speakers.controller';
import { SpeakersService } from './speakers.service';
import { SpeakerIdentifierService } from './speaker-identifier.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SpeakersController],
  providers: [SpeakersService, SpeakerIdentifierService],
  exports: [SpeakersService, SpeakerIdentifierService],
})
export class SpeakersModule {}
