import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@petiatrics/types';
import { ReasonCodeService } from '../services/reason-code.service';
import { CreateReasonCodeDto, UpdateReasonCodeDto } from '../dto/reason-code.dto';
import { ActiveBranch, TenantId } from '../../../common/decorators/tenant.decorator';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

@Controller('inventory/reason-codes')
@UseGuards(BranchContextGuard)
export class ReasonCodeController {
  constructor(private readonly reasonCodeService: ReasonCodeService) {}

  @Get()
  async findAll(@TenantId() clinicId: string, @ActiveBranch() branchId?: string) {
    return this.reasonCodeService.findAll(clinicId, branchId);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async create(@TenantId() clinicId: string, @Body() dto: CreateReasonCodeDto) {
    return this.reasonCodeService.create(clinicId, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReasonCodeDto,
  ) {
    return this.reasonCodeService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async remove(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.reasonCodeService.remove(clinicId, id);
  }
}
