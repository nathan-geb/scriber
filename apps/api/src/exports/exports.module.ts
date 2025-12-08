import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ExportsController],
  providers: [ExportsService, PrismaService],
})
export class ExportsModule {}
