import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId, ActiveBranch } from '../../../common/decorators/tenant.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { UserContext, Role } from '@petiatrics/types';
import { SupplierPaymentService } from '../services/supplier-payment.service';
import { CreateSupplierPaymentDto } from '../dtos/create-supplier-payment.dto';

const ALL_CLINIC_ROLES = [
  Role.SUPER_ADMIN,
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
];

@Controller('procurement/supplier-payments')
@Roles(...ALL_CLINIC_ROLES)
export class SupplierPaymentController {
  constructor(private readonly supplierPaymentService: SupplierPaymentService) {}

  @Post()
  @UseGuards(BranchContextGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @ActiveBranch() branchId: string,
    @Body() dto: CreateSupplierPaymentDto,
  ) {
    return this.supplierPaymentService.create(clinicId, user.userId, branchId, dto);
  }

  @Get()
  findAll(@TenantId() clinicId: string) {
    return this.supplierPaymentService.findAll(clinicId);
  }

  @Get(':id')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.supplierPaymentService.findOne(clinicId, id);
  }
}
