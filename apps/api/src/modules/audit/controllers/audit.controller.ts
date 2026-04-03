import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { AuditService } from '../services/audit.service';

@Controller('audit/logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Clinic-scoped audit log query — accessible by Clinic Manager.
   * Returns paginated logs scoped to the current clinic.
   */
  @Get()
  @Roles(Role.CLINIC_OWNER)
  query(
    @TenantId() clinicId: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('operation') operation?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.query({
      clinicId,
      actorId,
      entityType,
      entityId,
      operation,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
    });
  }
}
