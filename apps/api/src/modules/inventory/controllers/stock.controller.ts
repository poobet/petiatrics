import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { StockService } from '../services/stock.service';
import { GoodsReceiptDto } from '../dto/goods-receipt.dto';
import { GoodsIssueDto } from '../dto/goods-issue.dto';
import { ListStockBalancesDto } from '../dto/list-stock-balances.dto';

@Controller('inventory')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('stock/replenish')
  @Roles(Role.CLINIC_OWNER)
  @Permissions('MANAGE_INVENTORY')
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

  @Get('stock/movements')
  @Roles(Role.CLINIC_OWNER, Role.VET)
  @Permissions('VIEW_INVENTORY')
  @UseGuards(BranchContextGuard)
  getMovements(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Query('productId') productId?: string,
  ) {
    return this.stockService.getMovements(clinicId, branchId, productId);
  }

  @Get('products/:productId/all-branch-balances')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF, Role.ASSISTANT, Role.CASHIER)
  @Permissions('VIEW_INVENTORY')
  @UseGuards(BranchContextGuard)
  getAllBranchBalances(
    @TenantId() clinicId: string,
    @Param('productId') productId: string,
    @Query() query: ListStockBalancesDto,
  ) {
    return this.stockService.listBalances(clinicId, {
      productId,
      lowStock: query.lowStock,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  // ─── Stock Balances (US1 / US4) ────────────────────────────────────────────

  @Get('stock-balances')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF, Role.ASSISTANT, Role.CASHIER)
  @Permissions('VIEW_INVENTORY')
  @UseGuards(BranchContextGuard)
  listBalances(
    @TenantId() clinicId: string,
    @ActiveBranch() sessionBranchId: string,
    @Query() query: ListStockBalancesDto,
  ) {
    // Default to the active session branch; CLINIC_OWNER may override with an explicit
    // query.branchId to view another branch (e.g. cross-branch admin reports).
    const branchId = query.branchId ?? sessionBranchId;

    return this.stockService.listBalances(clinicId, {
      branchId,
      productId: query.productId,
      lowStock: query.lowStock,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('stock-balances/lots/:productId')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF, Role.ASSISTANT, Role.CASHIER)
  @Permissions('VIEW_INVENTORY')
  @UseGuards(BranchContextGuard)
  getIssuableLots(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Param('productId') productId: string,
  ) {
    return this.stockService.getIssuableLots(clinicId, branchId, productId);
  }

  // ─── Stock Movements — Receipt & Issue (US1, US2) ──────────────────────────

  @Post('stock-movements')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF, Role.ASSISTANT, Role.CASHIER)
  @Permissions('MANAGE_INVENTORY')
  @UseGuards(BranchContextGuard)
  @Audit({ entity: 'StockMovement', operation: 'create' })
  createMovement(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Body() body: (GoodsReceiptDto | GoodsIssueDto) & { movementType: 'GOODS_RECEIPT' | 'GOODS_ISSUE' },
  ) {
    if (body.movementType === 'GOODS_RECEIPT') {
      return this.stockService.goodsReceipt(clinicId, branchId, user.userId, body as GoodsReceiptDto);
    }
    return this.stockService.goodsIssue(clinicId, branchId, user.userId, body as GoodsIssueDto);
  }
}
