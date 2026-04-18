import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

/**
 * ReferenceController — read-only global reference data endpoints.
 *
 * These endpoints serve system-seeded, non-tenant-owned reference tables
 * (e.g. TaxCode) that all authenticated clinic users may read.
 * No clinic scoping is applied — TaxCode is global.
 */
@Controller('reference')
@UseGuards(BranchContextGuard)
export class ReferenceController {
  constructor(private readonly bpService: BusinessPartnerService) {}

  /**
   * GET /api/v1/reference/tax-codes
   * Return all active TaxCode records for use in the BP form VAT/WHT selectors.
   * Accessible to all authenticated clinic users (read-only reference data).
   */
  @Get('tax-codes')
  listTaxCodes() {
    return this.bpService.listTaxCodes();
  }

  /**
   * GET /api/v1/reference/contact-positions
   * Return all active ContactPosition records for use in the BpContact position selector.
   * Global (no clinic scoping). Inherits BranchContextGuard from controller class.
   */
  @Get('contact-positions')
  listContactPositions() {
    return this.bpService.listContactPositions();
  }
}
