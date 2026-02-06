import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class MemberRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { userId: string; email: string; role: string; orgId: string }
      | undefined;

    if (!user?.userId) {
      return false;
    }

    // Try to find organizationId from params, query, or body
    const organizationId =
      (request.params?.organizationId as string | undefined) ||
      (request.query?.organizationId as string | undefined) ||
      (request.body?.organizationId as string | undefined) ||
      user.orgId;

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      return false;
    }

    // Hierarchical roles: OWNER > ADMIN > MEMBER > VIEWER
    const roleHierarchy: Record<string, number> = {
      OWNER: 4,
      ADMIN: 3,
      MEMBER: 2,
      VIEWER: 1,
      GUEST: 0,
    };

    const userRoleValue = roleHierarchy[membership.role] || 0;

    return requiredRoles.some((role) => {
      const requiredValue = roleHierarchy[role] || 0;
      return userRoleValue >= requiredValue;
    });
  }
}
