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
  InviteUserDto,
  UpdateUserRoleDto,
} from '../services/user.service';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId, CurrentUser } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import type { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';

@Controller('clinic/staff')
@Roles(Role.CLINIC_OWNER)
export class StaffController {
  constructor(private readonly users: UserService) {}

  /**
   * GET /api/v1/clinic/staff
   * List all staff in the current clinic.
   */
  @Get()
  list(@TenantId() clinicId: string) {
    return this.users.findByClinic(clinicId);
  }

  /**
   * POST /api/v1/clinic/staff/invite
   * Clinic Admin invites a new staff member.
   */
  @Post('invite')
  @Audit({ entity: 'users', operation: 'create' })
  async invite(
    @Body() dto: Omit<InviteUserDto, 'clinicId' | 'invitedBy'>,
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
  ) {
    const result = await this.users.invite({
      ...dto,
      clinicId,
      invitedBy: user.userId,
    });
    // Don't surface temporaryPassword in normal response — return just the user
    const { temporaryPassword: _pwd, ...userRecord } = result;
    return userRecord;
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
