import { SetMetadata } from '@nestjs/common';

// We use string instead of enum from @prisma/client to avoid issues if generate fails
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
