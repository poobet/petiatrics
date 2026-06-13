import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { PatientService, CreatePatientDto, UpdatePatientDto } from '../services/patient.service';
import { PrismaClient } from '@prisma/client';

@Controller('patients')
@Roles(
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
  Role.CUSTOMER,
)
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post()
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'PetProfile', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientService.create(clinicId, dto);
  }

  @Get()
  @Permissions('PATIENT:VIEW')
  async findAll(
    @TenantId() clinicId: string | null,
    @CurrentUser() user: UserContext,
    @Query('search') search?: string,
    @Query('ownerUserId') ownerUserId?: string,
  ) {
    if (user.role === Role.CUSTOMER) {
      const bps = await this.prisma.businessPartner.findMany({
        where: { linkedUserId: user.userId, isActive: true },
        select: { clinicId: true },
      });
      const clinicIds = bps.map((bp) => bp.clinicId);
      return this.patientService.findAllByOwnerCrossClinic(clinicIds, user.userId);
    }
    return this.patientService.findAll(clinicId!, search, ownerUserId);
  }

  @Get(':id')
  @Permissions('PATIENT:VIEW')
  async findOne(
    @TenantId() clinicId: string | null,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    if (user.role === Role.CUSTOMER) {
      const pet = await this.patientService.findByIdCrossClinic(id);
      if (pet.ownerUserId !== user.userId) {
        throw new ForbiddenException('You do not have permission to access this patient.');
      }
      return pet;
    }
    return this.patientService.findById(clinicId!, id);
  }

  @Patch(':id')
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'PetProfile', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientService.update(clinicId, id, dto);
  }
}
