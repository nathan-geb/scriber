import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users/usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) { }

  @Get()
  async getUsage(@Request() req: { user: { userId: string } }) {
    const usage = await this.usageService.getUserUsage(req.user.userId);
    return {
      ...usage,
      remainingUploads: Math.max(
        0,
        usage.maxUploadsPerWeek - usage.uploadsThisWeek,
      ),
      remainingMinutes: Math.max(
        0,
        usage.monthlyMinutesLimit - usage.minutesThisWeek,
      ),
    };
  }
}
