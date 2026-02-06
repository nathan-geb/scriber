import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  Request as NestRequest,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberRolesGuard } from '../auth/guards/member-roles.guard';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) { }

  @UseGuards(JwtAuthGuard, MemberRolesGuard)
  @Roles('ADMIN', 'OWNER')
  @Post('checkout')
  async createCheckout(
    @NestRequest() req: { user: { userId: string } },
    @Body('planId') planId: string,
  ) {
    const session = await this.billingService.createCheckoutSession(
      req.user.userId,
      planId,
    );
    return { url: session.url };
  }

  @UseGuards(JwtAuthGuard, MemberRolesGuard)
  @Roles('ADMIN', 'OWNER')
  @Post('status')
  async getStatus(@NestRequest() _req: { user: { userId: string } }) {
    return { status: 'active' }; // Simplified for now
  }

  @Post('webhook')
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      return { received: false };
    }
    await this.billingService.handleWebhook(signature, payload);
    return { received: true };
  }
}
