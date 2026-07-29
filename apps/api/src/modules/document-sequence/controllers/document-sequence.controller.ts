import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { DocumentSequenceService } from '../services/document-sequence.service';

@Controller('document-sequence')
@Roles(Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.STAFF, Role.VET, Role.CASHIER)
export class DocumentSequenceController {
  constructor(private readonly documentSequenceService: DocumentSequenceService) {}

  @Get('sequences')
  getCurrentSequences(
    @TenantId() clinicId: string,
    @Query('module') module?: string,
  ) {
    return this.documentSequenceService.getCurrentSequences(clinicId, module);
  }
}
