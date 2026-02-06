import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { UsageModule } from '../usage/usage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

import { BillingController } from './billing.controller';

@Module({
  imports: [UsageModule, PrismaModule, ConfigModule],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
