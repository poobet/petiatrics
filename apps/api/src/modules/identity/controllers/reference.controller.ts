import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { TenantId } from '../../../common/decorators/tenant.decorator';

/**
 * ReferenceController — read-only reference data endpoints.
 *
 * - TaxCode: global (no clinic scoping)
 * - BpGroup: clinic-scoped (reads clinicId from session via TenantId)
 */
@Controller('reference')
@UseGuards(BranchContextGuard)
export class ReferenceController {
  constructor(private readonly bpService: BusinessPartnerService) {}

  /**
   * GET /api/v1/reference/tax-codes
   * Return all active TaxCode records for use in the BP form VAT/WHT selectors.
   */
  @Get('tax-codes')
  listTaxCodes() {
    return this.bpService.listTaxCodes();
  }

  /**
   * GET /api/v1/reference/bp-groups
   * Return all active BpGroup records for the current clinic.
   */
  @Get('bp-groups')
  listBpGroups(@TenantId() clinicId: string) {
    return this.bpService.listBpGroups(clinicId);
  }
}
