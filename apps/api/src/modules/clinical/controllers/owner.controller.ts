import {
  Controller,
  Get,
  Param,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser } from '../../../common/decorators/tenant.decorator';
import { Role, UserContext } from '@petiatrics/types';
import { PatientService } from '../services/patient.service';
import { VisitService } from '../services/visit.service';
import { VaccinationService } from '../services/vaccination.service';
import { PrismaClient } from '@prisma/client';
import { IPetProfile } from '@petiatrics/database';

@Controller('owner')
@Roles(Role.CUSTOMER)
export class OwnerController {
  constructor(
    private readonly patientService: PatientService,
    private readonly visitService: VisitService,
    private readonly vaccinationService: VaccinationService,
    private readonly prisma: PrismaClient,
  ) {}

  private async validatePetOwnershipCrossClinic(petId: string, userId: string): Promise<IPetProfile> {
    const pet = await this.patientService.findByIdCrossClinic(petId);
    if (pet.ownerUserId !== userId) {
      throw new ForbiddenException('You do not have permission to access records for this pet.');
    }
    return pet;
  }

  @Get('pets')
  async getPets(@CurrentUser() user: UserContext) {
    const bps = await this.prisma.businessPartner.findMany({
      where: { linkedUserId: user.userId, isActive: true },
      select: { clinicId: true },
    });
    const clinicIds = bps.map((bp) => bp.clinicId);
    return this.patientService.findAllByOwnerCrossClinic(clinicIds, user.userId);
  }

  @Get('pets/:id/records')
  async getPetRecords(
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
  ) {
    const pet = await this.validatePetOwnershipCrossClinic(petId, user.userId);
    return this.visitService.findByPatient(pet.clinicId, petId);
  }

  @Get('pets/:id/vaccinations')
  async getPetVaccinations(
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
  ) {
    const pet = await this.validatePetOwnershipCrossClinic(petId, user.userId);
    return this.vaccinationService.listByPatient(pet.clinicId, petId);
  }

  @Get('pets/:id/records/:visitId')
  async getPetRecord(
    @CurrentUser() user: UserContext,
    @Param('id') petId: string,
    @Param('visitId') visitId: string,
  ) {
    const pet = await this.validatePetOwnershipCrossClinic(petId, user.userId);
    const visit = await this.visitService.getOne(pet.clinicId, visitId);
    if (visit.patientId.toString() !== petId) {
      throw new NotFoundException('Visit record not found for this pet.');
    }
    return visit;
  }
}
