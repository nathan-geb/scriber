import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // Check implementation here: check weekly usage vs plan limits
    // For MVP/Auth phase, we just ensure user has a subscription
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: user.userId },
      include: {
        plan: true,
        usage: { orderBy: { weekStartDate: 'desc' }, take: 1 },
      },
    });

    if (!subscription || !subscription.active) {
      throw new ForbiddenException('No active subscription');
    }

    // Example limit check (to be expanded)
    // if (request.path.includes('upload') && subscription.usage[0]?.uploadCount >= subscription.plan.maxUploadsPerWeek) {
    //   throw new ForbiddenException('Weekly upload limit reached');
    // }

    return true;
  }
}
