import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId, ActiveBranch } from '../../../common/decorators/tenant.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { UserContext, Role } from '@petiatrics/types';
import { GoodsReceiptService } from '../services/goods-receipt.service';
import { CreateGoodsReceiptDto } from '../dtos/create-goods-receipt.dto';

const ALL_CLINIC_ROLES = [
  Role.SUPER_ADMIN,
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
];

@Controller('procurement/goods-receipts')
@Roles(...ALL_CLINIC_ROLES)
export class GoodsReceiptController {
  constructor(private readonly goodsReceiptService: GoodsReceiptService) {}

  @Post()
  @UseGuards(BranchContextGuard)
  @HttpCode(HttpStatus.CREATED)
  createAndCommit(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @ActiveBranch() branchId: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.goodsReceiptService.createAndCommit(clinicId, user.userId, branchId, dto);
  }

  @Get()
  findAll(@TenantId() clinicId: string) {
    return this.goodsReceiptService.findAll(clinicId);
  }

  @Get(':id')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.goodsReceiptService.findOne(clinicId, id);
  }
}
