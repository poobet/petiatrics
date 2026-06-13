import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import {
  VisitService,
  CreateVisitDto,
  UpdateVisitDto,
  AmendVisitDto,
} from '../services/visit.service';
import { PatientService } from '../services/patient.service';

@Controller('patients/:patientId/visits')
@Roles(
  Role.CLINIC_OWNER,
  Role.VET,
  Role.ASSISTANT,
  Role.CASHIER,
  Role.STAFF,
  Role.CUSTOMER,
)
export class VisitController {
  constructor(
    private readonly visitService: VisitService,
    private readonly patientService: PatientService,
  ) {}

  @Post()
  @Permissions('VISIT:ADD')
  @Audit({ entity: 'VisitRecord', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Param('patientId') patientId: string,
    @Body() dto: Omit<CreateVisitDto, 'patientId' | 'branchId'>,
  ) {
    return this.visitService.create(clinicId, { ...dto, patientId, branchId });
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
      return this.visitService.findByPatient(pet.clinicId, patientId);
    }
    return this.visitService.findByPatient(clinicId!, patientId);
  }

  @Get(':visitId')
  @Permissions('VISIT:VIEW')
  async getOne(
    @TenantId() clinicId: string | null,
    @CurrentUser() user: UserContext,
    @Param('visitId') visitId: string,
  ) {
    if (user.role === Role.CUSTOMER) {
      const visit = await this.visitService.getOneCrossClinic(visitId);
      const pet = await this.patientService.findByIdCrossClinic(visit.patientId.toString());
      if (pet.ownerUserId !== user.userId) {
        throw new ForbiddenException('You do not have permission to access records for this pet.');
      }
      return visit;
    }
    return this.visitService.getOne(clinicId!, visitId);
  }

  @Patch(':visitId')
  @Permissions('VISIT:EDIT')
  @Audit({ entity: 'VisitRecord', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('visitId') visitId: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitService.update(clinicId, visitId, dto);
  }

  @Post(':visitId/finalize')
  @Permissions('VISIT:EDIT')
  @Audit({ entity: 'VisitRecord', operation: 'status_change' })
  finalize(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Param('visitId') visitId: string,
  ) {
    return this.visitService.finalize(clinicId, visitId, user.userId, branchId);
  }

  @Post(':visitId/amend')
  @Roles(Role.CLINIC_OWNER)
  @Permissions('VISIT:EDIT')
  @Audit({ entity: 'VisitRecord', operation: 'amend' })
  amend(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('visitId') visitId: string,
    @Body() dto: AmendVisitDto,
  ) {
    return this.visitService.amend(clinicId, visitId, user.userId, dto);
  }
}
