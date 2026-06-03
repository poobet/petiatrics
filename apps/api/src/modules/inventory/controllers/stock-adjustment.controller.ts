import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { StockAdjustmentService } from '../services/stock-adjustment.service';
import { SubmitAdjustmentDto } from '../dto/submit-adjustment.dto';
import { RejectAdjustmentDto } from '../dto/reject-adjustment.dto';

@Controller('inventory/stock-adjustments')
export class StockAdjustmentController {
  constructor(private readonly adjustmentService: StockAdjustmentService) {}

  @Get()
  @Roles(Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  listPending(
    @TenantId() clinicId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.adjustmentService.listPendingAdjustments(clinicId, branchId);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  @Audit({ entity: 'StockMovement', operation: 'create' })
  submit(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: SubmitAdjustmentDto,
  ) {
    return this.adjustmentService.submitAdjustment(clinicId, branchId, user.userId, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  @Audit({ entity: 'StockMovement', operation: 'update' })
  approve(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') movementId: string,
  ) {
    return this.adjustmentService.approveAdjustment(clinicId, user.userId, movementId);
  }

  @Patch(':id/reject')
  @Roles(Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  @Audit({ entity: 'StockMovement', operation: 'update' })
  reject(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') movementId: string,
    @Body() dto: RejectAdjustmentDto,
  ) {
    return this.adjustmentService.rejectAdjustment(clinicId, user.userId, movementId, dto);
  }
}
