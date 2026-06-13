import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserContext } from '@petiatrics/types';

/**
 * Extracts the current tenant's clinicId from the session context.
 *
 * @example
 *   @Get('patients')
 *   list(@TenantId() clinicId: string) { ... }
 */
import { Role } from '@petiatrics/types';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
    const clinicId = request.userContext?.clinicId;
    if (!clinicId && request.userContext?.role !== Role.CUSTOMER) {
      throw new Error('TenantId decorator used on a route without a session context.');
    }
    return clinicId ?? null;
  },
);

/**
 * Extracts the full UserContext from the request.
 *
 * @example
 *   @Get('me')
 *   me(@CurrentUser() user: UserContext) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
    const userContext = request.userContext;
    if (!userContext) {
      throw new Error('CurrentUser decorator used on a route without a session context.');
    }
    return userContext;
  },
);

/**
 * Extracts the active branchId from the request context.
 * Requires BranchContextGuard or middleware that resolves activeBranchId on the request.
 *
 * @example
 *   @Get('stock')
 *   list(@ActiveBranch() branchId: string) { ... }
 */
export const ActiveBranch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { activeBranchId?: string }>();
    if (!request.activeBranchId) {
      throw new Error('ActiveBranch decorator used on a route without a resolved branch context.');
    }
    return request.activeBranchId;
  },
);
