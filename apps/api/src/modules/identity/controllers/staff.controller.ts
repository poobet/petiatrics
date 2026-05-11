import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  UserService,
  UpdateUserRoleDto,
} from '../services/user.service';
import { ClinicService } from '../services/clinic.service';
import { CreateStaffDto } from '../dto/create-staff.dto';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId, CurrentUser } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import type { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';

@Controller('clinic/staff')
@Roles(Role.CLINIC_OWNER)
export class StaffController {
  constructor(
    private readonly users: UserService,
    private readonly clinics: ClinicService,
  ) {}

  /**
   * GET /api/v1/clinic/staff
   * List all staff in the current clinic.
   */
  @Get()
  list(@TenantId() clinicId: string) {
    return this.users.findByClinic(clinicId);
  }

  /**
   * POST /api/v1/clinic/staff
   * US4: Clinic Owner creates a staff member with username@clinicSlug identity.
   */
  @Post()
  @Audit({ entity: 'users', operation: 'create' })
  async createStaff(
    @Body() dto: CreateStaffDto,
    @TenantId() clinicId: string,
  ) {
    const clinic = await this.clinics.findById(clinicId);
    return this.users.createStaff({
      usernamePrefix: dto.usernamePrefix,
      clinicSlug: clinic.slug,
      clinicId,
      name: dto.name,
      temporaryPassword: dto.temporaryPassword,
      role: dto.role,
      branchIds: dto.branchIds,
    });
  }

  /**
   * PATCH /api/v1/clinic/staff/:id/role
   * Clinic Admin changes a staff member's role.
   */
  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @Audit({ entity: 'users', operation: 'update' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @TenantId() clinicId: string,
  ) {
    return this.users.updateRole(id, clinicId, dto);
  }

  /**
   * DELETE /api/v1/clinic/staff/:id
   * Clinic Admin deactivates a staff member.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit({ entity: 'users', operation: 'status_change' })
  deactivate(
    @Param('id') id: string,
    @TenantId() clinicId: string,
  ) {
    return this.users.deactivate(id, clinicId);
  }
}
