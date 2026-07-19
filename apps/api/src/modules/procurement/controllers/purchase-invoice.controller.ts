import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId, ActiveBranch } from '../../../common/decorators/tenant.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { UserContext, Role } from '@petiatrics/types';
import { PurchaseInvoiceService } from '../services/purchase-invoice.service';
import { CreatePurchaseInvoiceDto } from '../dtos/create-purchase-invoice.dto';

const ALL_CLINIC_ROLES = [
  Role.SUPER_ADMIN,
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
];

@Controller('procurement/purchase-invoices')
@Roles(...ALL_CLINIC_ROLES)
export class PurchaseInvoiceController {
  constructor(private readonly purchaseInvoiceService: PurchaseInvoiceService) {}

  @Post()
  @UseGuards(BranchContextGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @ActiveBranch() branchId: string,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchaseInvoiceService.create(clinicId, user.userId, branchId, dto);
  }

  @Get()
  findAll(@TenantId() clinicId: string, @Query('status') status?: string) {
    return this.purchaseInvoiceService.findAll(clinicId, status as any);
  }

  @Get(':id')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseInvoiceService.findOne(clinicId, id);
  }

  @Post(':id/match')
  @HttpCode(HttpStatus.OK)
  performMatch(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseInvoiceService.performMatch(clinicId, id);
  }

  @Patch(':id/post')
  post(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseInvoiceService.post(clinicId, id);
  }

  @Patch(':id/void')
  void(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseInvoiceService.void(clinicId, id);
  }
}
