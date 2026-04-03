import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { CurrentUser } from '../../../common/decorators/tenant.decorator';
import type { UserContext } from '@petiatrics/types';

interface BranchTestResponse {
  clinicId: string | null;
  activeBranchId: string;
  userId: string;
  role: string;
}

/**
 * BranchTestController
 *
 * Verification endpoint for User Story 3 — confirms that the branch context
 * header flows end-to-end from the client Zustand store → api-client →
 * BranchContextGuard → controller.
 *
 * Route: GET /api/v1/inventory/test
 * Requires: active session + valid x-active-branch header
 */
@Controller('inventory/test')
export class BranchTestController {
  @Get()
  @UseGuards(BranchContextGuard)
  test(
    @CurrentUser() user: UserContext,
    @Req() req: Request & { activeBranchId?: string },
  ): BranchTestResponse {
    return {
      clinicId: user.clinicId,
      activeBranchId: req.activeBranchId ?? '',
      userId: user.userId,
      role: user.role as string,
    };
  }
}
