import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { UserContext, Role } from '@petiatrics/types';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto';

const ALL_CLINIC_ROLES = [
  Role.SUPER_ADMIN,
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
];

@Controller('procurement/purchase-orders')
@Roles(...ALL_CLINIC_ROLES)
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrderService.create(clinicId, user.userId, user.role, dto);
  }

  @Get()
  findAll(@TenantId() clinicId: string) {
    return this.purchaseOrderService.findAll(clinicId);
  }

  @Get(':id')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseOrderService.findOne(clinicId, id);
  }

  @Patch(':id/submit')
  submitForApproval(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseOrderService.submitForApproval(clinicId, id);
  }

  @Patch(':id/approve')
  approve(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.purchaseOrderService.approve(clinicId, user.userId, user.role, id);
  }

  @Patch(':id/cancel')
  cancel(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.purchaseOrderService.cancel(clinicId, id);
  }
}
