import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { VaccinationService, CreateVaccinationDto } from '../services/vaccination.service';

@Controller('patients/:patientId/vaccinations')
@Roles(Role.VET, Role.CLINIC_OWNER)
export class VaccinationController {
  constructor(private readonly vaccinationService: VaccinationService) {}

  @Post()
  @Permissions('VACCINATION:ADD')
  @Audit({ entity: 'VaccinationRecord', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @Param('patientId') patientId: string,
    @Body() dto: Omit<CreateVaccinationDto, 'patientId'>,
  ) {
    return this.vaccinationService.create(clinicId, { ...dto, patientId });
  }

  @Get()
  @Permissions('VISIT:VIEW')
  list(
    @TenantId() clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.vaccinationService.listByPatient(clinicId, patientId);
  }

  @Get(':id')
  @Permissions('VISIT:VIEW')
  getOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.vaccinationService.getOne(clinicId, id);
  }
}
