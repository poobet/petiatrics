import {
  Controller,
  Get,
  Param,
  ForbiddenException,
  NotFoundException,
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

  private async validatePetOwnership(clinicId: string, petId: string, userId: string): Promise<void> {
    const pet = await this.patientService.findById(clinicId, petId);
    if (pet.ownerUserId !== userId) {
      throw new ForbiddenException('You do not have permission to access records for this pet.');
    }
  }

  @Get('pets')
  getPets(@TenantId() clinicId: string, @CurrentUser() user: UserContext) {
    // Owners only see their own pets by filtering on ownerUserId
    return this.patientService.findAllByOwner(clinicId, user.userId);
  }

  @Get('pets/:id/records')
  async getPetRecords(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
  ) {
    await this.validatePetOwnership(clinicId, petId, user.userId);
    return this.visitService.findByPatient(clinicId, petId);
  }

  @Get('pets/:id/vaccinations')
  async getPetVaccinations(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
  ) {
    await this.validatePetOwnership(clinicId, petId, user.userId);
    return this.vaccinationService.listByPatient(clinicId, petId);
  }

  @Get('pets/:id/records/:visitId')
  async getPetRecord(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
    @Param('visitId') visitId: string,
  ) {
    await this.validatePetOwnership(clinicId, petId, user.userId);
    const visit = await this.visitService.getOne(clinicId, visitId);
    if (visit.patientId.toString() !== petId) {
      throw new NotFoundException('Visit record not found for this pet.');
    }
    return visit;
  }
}
