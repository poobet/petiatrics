import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Role } from '@petiatrics/types';
import { InventoryLocationService } from '../services/inventory-location.service';
import { CreateInventoryLocationDto, UpdateInventoryLocationDto } from '../dto/inventory-location.dto';
import { ActiveBranch, TenantId } from '../../../common/decorators/tenant.decorator';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

@Controller('inventory/locations')
@UseGuards(BranchContextGuard)
export class InventoryLocationController {
  constructor(private readonly locationService: InventoryLocationService) {}

  @Get()
  async findAll(@TenantId() clinicId: string, @ActiveBranch() branchId: string) {
    return this.locationService.findAll(clinicId, branchId);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async create(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Body() dto: CreateInventoryLocationDto,
  ) {
    return this.locationService.create(clinicId, branchId, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async update(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryLocationDto,
  ) {
    return this.locationService.update(clinicId, branchId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.STAFF)
  @Permissions('inventory:manage')
  async remove(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Param('id') id: string,
  ) {
    return this.locationService.remove(clinicId, branchId, id);
  }
}
