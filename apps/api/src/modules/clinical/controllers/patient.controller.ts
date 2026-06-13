import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { PatientService, CreatePatientDto, UpdatePatientDto } from '../services/patient.service';

@Controller('patients')
@Roles(Role.VET, Role.CLINIC_OWNER)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Permissions('EDIT_PATIENTS')
  @Audit({ entity: 'PetProfile', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientService.create(clinicId, dto);
  }

  @Get()
  @Permissions('VIEW_PATIENTS')
  findAll(
    @TenantId() clinicId: string,
    @Query('search') search?: string,
  ) {
    return this.patientService.findAll(clinicId, search);
  }

  @Get(':id')
  @Permissions('VIEW_PATIENTS')
  findOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.patientService.findById(clinicId, id);
  }

  @Patch(':id')
  @Permissions('EDIT_PATIENTS')
  @Audit({ entity: 'PetProfile', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientService.update(clinicId, id, dto);
  }
}
