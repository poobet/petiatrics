import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessPartnerService } from '../services/business-partner.service';
import { CreateBusinessPartnerDto } from '../dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from '../dto/update-business-partner.dto';
import { ListBusinessPartnersDto } from '../dto/list-business-partners.dto';
import { Roles } from '../../../common/guards/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { TenantId, CurrentUser } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import type { UserContext } from '@petiatrics/types';

const WRITE_ROLES = [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.STAFF];

// BPs are clinic-scoped (clinicId from session). GET endpoints only need the
// session guard (via RolesGuard parent chain) — no branch header required.
// Write endpoints add BranchContextGuard for operational context enforcement.
@Controller('clinic/business-partners')
@UseGuards(RolesGuard)
export class BusinessPartnersController {
  constructor(private readonly bpService: BusinessPartnerService) {}

  /**
   * GET /api/v1/clinic/business-partners
   * List active BPs (or inactive when includeInactive=true and caller has management access).
   * Accessible to all authenticated clinic users.
   */
  @Get()
  list(
    @TenantId() clinicId: string,
    @Query() query: ListBusinessPartnersDto,
    @CurrentUser() user: UserContext,
  ) {
    const isManager = WRITE_ROLES.includes(user.role);
    return this.bpService.list(clinicId, query, isManager);
  }

  /**
   * GET /api/v1/clinic/business-partners/:id
   * Return a single BP including inactive records for management callers.
   */
  @Get(':id')
  getById(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.bpService.getById(id, clinicId);
  }

  /**
   * POST /api/v1/clinic/business-partners
   * Create BP — allowed for SUPER_ADMIN, CLINIC_OWNER, STAFF only.
   */
  @Post()
  @Roles(...WRITE_ROLES)
  @UseGuards(BranchContextGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBusinessPartnerDto, @TenantId() clinicId: string) {
    return this.bpService.create(clinicId, dto);
  }

  /**
   * PATCH /api/v1/clinic/business-partners/:id
   * Update BP — allowed for SUPER_ADMIN, CLINIC_OWNER, STAFF only.
   */
  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @UseGuards(BranchContextGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessPartnerDto,
    @TenantId() clinicId: string,
  ) {
    return this.bpService.update(id, clinicId, dto);
  }

  /**
   * PATCH /api/v1/clinic/business-partners/:id/deactivate
   * Soft-delete BP — allowed for SUPER_ADMIN and CLINIC_OWNER only.
   */
  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.CLINIC_OWNER)
  @UseGuards(BranchContextGuard)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.bpService.deactivate(id, clinicId);
  }
}
