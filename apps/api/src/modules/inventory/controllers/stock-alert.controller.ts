import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { StockAlertService } from '../services/stock-alert.service';

@Controller('inventory/alerts')
export class StockAlertController {
  constructor(private readonly alertService: StockAlertService) {}

  @Get('low-stock')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF, Role.ASSISTANT, Role.CASHIER)
  @UseGuards(BranchContextGuard)
  listLowStockAlerts(
    @TenantId() clinicId: string,
    @ActiveBranch() sessionBranchId: string,
    @CurrentUser() user: UserContext,
    @Query('branchId') branchId?: string,
  ) {
    // Non-owners are scoped to their session branch
    const effectiveBranchId =
      user.role === Role.CLINIC_OWNER ? branchId : sessionBranchId;

    return this.alertService.listActive(clinicId, effectiveBranchId);
  }
}
