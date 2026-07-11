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
  Put,
} from '@nestjs/common';
import { ClinicRoleService } from './clinic-role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('clinic/roles')
@Permissions('SETTINGS:MANAGE')
export class ClinicRoleController {
  constructor(private readonly roleService: ClinicRoleService) {}

  /** GET /api/v1/clinic/roles — list all roles for this clinic */
  @Get()
  list(@TenantId() clinicId: string) {
    return this.roleService.listRoles(clinicId);
  }

  /** POST /api/v1/clinic/roles — create a custom role */
  @Post()
  create(@Body() dto: CreateRoleDto, @TenantId() clinicId: string) {
    return this.roleService.createRole(clinicId, dto);
  }

  /** PATCH /api/v1/clinic/roles/:id — rename a role */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  rename(
    @Param('id') id: string,
    @Body() dto: { name: string },
    @TenantId() clinicId: string,
  ) {
    return this.roleService.renameRole(clinicId, id, dto.name);
  }

  /** DELETE /api/v1/clinic/roles/:id — delete a custom role */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.roleService.deleteRole(clinicId, id);
  }

  /** GET /api/v1/clinic/roles/:id/permissions */
  @Get(':id/permissions')
  getPermissions(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.roleService.getRolePermissions(clinicId, id);
  }

  /** PUT /api/v1/clinic/roles/:id/permissions — replace full permission set */
  @Put(':id/permissions')
  @HttpCode(HttpStatus.OK)
  setPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @TenantId() clinicId: string,
  ) {
    return this.roleService.setRolePermissions(clinicId, id, dto.permissions);
  }
}

@Controller('clinic/pages')
@Permissions('SETTINGS:MANAGE')
export class ClinicPagesController {
  constructor(private readonly roleService: ClinicRoleService) {}

  /** GET /api/v1/clinic/pages — list all PageMaster + ActionMaster for UI */
  @Get()
  list() {
    return this.roleService.listPagesWithActions();
  }
}
