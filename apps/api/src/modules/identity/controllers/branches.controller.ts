import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { Roles } from '../../../common/guards/roles.decorator';
import { Role } from '@petiatrics/types';

@Controller('identity/branches')
@UseGuards(BranchContextGuard)
@Roles(Role.CLINIC_OWNER)
export class BranchesController {
  constructor(private readonly prisma: PrismaClient) {}

  @Get()
  async getBranches(@TenantId() clinicId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    });
    return { items: branches };
  }
}
