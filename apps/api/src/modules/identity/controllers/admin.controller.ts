import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClinicService, CreateClinicDto, UpdateClinicStatusDto } from '../services/clinic.service';
import { Roles } from '../../../common/guards/roles.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';

@Controller('admin')
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly clinics: ClinicService) {}

  /**
   * POST /api/v1/admin/clinics
   * Platform Admin creates a new clinic directly (active).
   */
  @Post('clinics')
  @Audit({ entity: 'clinics', operation: 'create' })
  createClinic(@Body() dto: CreateClinicDto) {
    return this.clinics.create(dto);
  }

  /**
   * GET /api/v1/admin/clinics
   * Platform Admin lists all clinics.
   */
  @Get('clinics')
  listClinics() {
    return this.clinics.findAll();
  }

  /**
   * GET /api/v1/admin/clinics/:id
   * Platform Admin fetches a specific clinic.
   */
  @Get('clinics/:id')
  getClinic(@Param('id') id: string) {
    return this.clinics.findById(id);
  }

  /**
   * PATCH /api/v1/admin/clinics/:id/approve
   * US2: Platform Admin approves a PENDING clinic registration.
   */
  @Patch('clinics/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Audit({ entity: 'clinics', operation: 'status_change' })
  approveClinic(@Param('id') id: string) {
    return this.clinics.approve(id);
  }

  /**
   * PATCH /api/v1/admin/clinics/:id/reject
   * US2: Platform Admin rejects a PENDING clinic registration.
   */
  @Patch('clinics/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Audit({ entity: 'clinics', operation: 'status_change' })
  rejectClinic(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.clinics.reject(id, body.reason);
  }

  /**
   * PATCH /api/v1/admin/clinics/:id/status
   * Platform Admin suspends or activates a clinic.
   */
  @Patch('clinics/:id/status')
  @HttpCode(HttpStatus.OK)
  @Audit({ entity: 'clinics', operation: 'status_change' })
  updateClinicStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClinicStatusDto,
  ) {
    return this.clinics.updateStatus(id, dto);
  }

  /**
   * GET /api/v1/admin/metrics
   * Platform Admin views platform-level KPIs.
   */
  @Get('metrics')
  getMetrics() {
    return this.clinics.getMetrics();
  }
}
