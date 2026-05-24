import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { StockService } from '../services/stock.service';

@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('replenish')
  @Roles(Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  @Audit({ entity: 'StockMovement', operation: 'create' })
  replenish(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Body() body: { productId: string; quantity: number; referenceId: string },
  ) {
    return this.stockService.replenish(clinicId, {
      ...body,
      branchId,
      actorId: user.userId,
    });
  }

  @Get('movements')
  @Roles(Role.CLINIC_OWNER, Role.VET)
  @UseGuards(BranchContextGuard)
  getMovements(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Query('productId') productId?: string,
  ) {
    return this.stockService.getMovements(clinicId, branchId, productId);
  }
}
