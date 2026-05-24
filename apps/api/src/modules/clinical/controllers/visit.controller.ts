import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
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

@Controller('patients/:patientId/visits')
@Roles(Role.VET, Role.CLINIC_OWNER)
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Post()
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
  list(
    @TenantId() clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.visitService.findByPatient(clinicId, patientId);
  }

  @Get(':visitId')
  getOne(
    @TenantId() clinicId: string,
    @Param('visitId') visitId: string,
  ) {
    return this.visitService.getOne(clinicId, visitId);
  }

  @Patch(':visitId')
  @Audit({ entity: 'VisitRecord', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('visitId') visitId: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitService.update(clinicId, visitId, dto);
  }

  @Post(':visitId/finalize')
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
