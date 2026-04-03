import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import type { UserContext } from '@petiatrics/types';
import { Role } from '@petiatrics/types';

export const ACTIVE_BRANCH_HEADER = 'x-active-branch';

/**
 * BranchContextGuard
 *
 * Applied to routes that require a validated branch context (e.g. inventory, billing, appointments).
 * Must be used AFTER SessionGuard (which attaches userContext to the request).
 *
 * Validates that the `x-active-branch` request header contains a branch UUID that
 * is present in the user's authorizedBranches list from the session. If valid,
 * attaches `activeBranchId` to the request object for downstream use.
 *
 * Returns 403 Forbidden if:
 *  - The header is absent
 *  - The header value is not in the user's authorized branch list
 *
 * Zero-trust: the backend never trusts branch IDs from request body/query params.
 */
@Injectable()
export class BranchContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        userContext?: UserContext;
        activeBranchId?: string;
      }
    >();

    const branchId = request.headers[ACTIVE_BRANCH_HEADER] as string | undefined;

    if (!branchId) {
      throw new ForbiddenException(
        'Missing x-active-branch header. Branch context is required for this endpoint.',
      );
    }

    const userContext = request.userContext;
    if (!userContext) {
      // SessionGuard must run before BranchContextGuard
      throw new ForbiddenException('No session context available.');
    }

    // SUPER_ADMIN bypasses branch authorization — accept any branch header value
    if (userContext.role !== Role.SUPER_ADMIN) {
      const isAuthorized = userContext.authorizedBranches.some((b) => b.id === branchId);
      if (!isAuthorized) {
        throw new ForbiddenException(
          `Branch ${branchId} is not in your authorized branch list.`,
        );
      }
    }

    // Inject resolved branch ID into request for downstream controllers/services
    request.activeBranchId = branchId;

    return true;
  }
}
