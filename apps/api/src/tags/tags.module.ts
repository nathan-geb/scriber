import { Module } from '@nestjs/common';
import { TagsController, MeetingTagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TagsController, MeetingTagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
