import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role, UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { VaccinationService, CreateVaccinationDto } from '../services/vaccination.service';
import { PatientService } from '../services/patient.service';

@Controller('patients/:patientId/vaccinations')
@Roles(
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
  Role.CUSTOMER,
)
export class VaccinationController {
  constructor(
    private readonly vaccinationService: VaccinationService,
    private readonly patientService: PatientService,
  ) {}

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
  async list(
    @TenantId() clinicId: string | null,
    @CurrentUser() user: UserContext,
    @Param('patientId') patientId: string,
  ) {
    if (user.role === Role.CUSTOMER) {
      const pet = await this.patientService.findByIdCrossClinic(patientId);
      if (pet.ownerUserId !== user.userId) {
        throw new ForbiddenException('You do not have permission to access records for this pet.');
      }
      return this.vaccinationService.listByPatient(pet.clinicId, patientId);
    }
    return this.vaccinationService.listByPatient(clinicId!, patientId);
  }

  @Get(':id')
  @Permissions('VISIT:VIEW')
  async getOne(
    @TenantId() clinicId: string | null,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    if (user.role === Role.CUSTOMER) {
      const vax = await this.vaccinationService.getOneCrossClinic(id);
      const pet = await this.patientService.findByIdCrossClinic(vax.patientId.toString());
      if (pet.ownerUserId !== user.userId) {
        throw new ForbiddenException('You do not have permission to access records for this pet.');
      }
      return vax;
    }
    return this.vaccinationService.getOne(clinicId!, id);
  }
}
