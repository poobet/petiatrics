import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role, UserContext } from '@petiatrics/types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() annotation — route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
    const userContext = request.userContext;

    if (!userContext) {
      throw new ForbiddenException('User context not found');
    }

    // SUPER_ADMIN bypasses all role restrictions
    if (
      userContext.role === 'SUPER_ADMIN' ||
      userContext.systemRole === 'SUPER_ADMIN'
    ) return true;

    const userRole = userContext.roleCode ?? userContext.role;
    if (!requiredRoles.includes(userRole as any)) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
