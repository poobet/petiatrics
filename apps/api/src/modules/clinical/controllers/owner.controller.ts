import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role, UserContext } from '@petiatrics/types';
import { PatientService } from '../services/patient.service';
import { VisitService } from '../services/visit.service';
import { VaccinationService } from '../services/vaccination.service';

@Controller('owner')
@Roles(Role.STAFF)
export class OwnerController {
  constructor(
    private readonly patientService: PatientService,
    private readonly visitService: VisitService,
    private readonly vaccinationService: VaccinationService,
  ) {}

  @Get('pets')
  getPets(@TenantId() clinicId: string, @CurrentUser() user: UserContext) {
    // Owners only see their own pets by filtering on ownerUserId
    return this.patientService.findAll(clinicId, undefined, user.userId);
  }

  @Get('pets/:id/records')
  getPetRecords(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
  ) {
    return this.visitService.findByPatient(clinicId, petId);
  }

  @Get('pets/:id/vaccinations')
  getPetVaccinations(
    @TenantId() clinicId: string,
    @Param('id') petId: string,
  ) {
    return this.vaccinationService.listByPatient(clinicId, petId);
  }
}
