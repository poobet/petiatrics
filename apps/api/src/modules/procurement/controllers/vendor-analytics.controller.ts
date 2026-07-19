import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { VendorAnalyticsService } from '../services/vendor-analytics.service';

const ANALYTICS_ROLES = [
  Role.SUPER_ADMIN,
  Role.CLINIC_OWNER,
  Role.VET,
];

@Controller('procurement/analytics')
@Roles(...ANALYTICS_ROLES)
export class VendorAnalyticsController {
  constructor(private readonly vendorAnalyticsService: VendorAnalyticsService) {}

  @Get('suppliers')
  getAllSupplierScorecards(@TenantId() clinicId: string) {
    return this.vendorAnalyticsService.getAllSupplierScorecards(clinicId);
  }

  @Get('suppliers/:supplierId')
  getSupplierScorecard(
    @TenantId() clinicId: string,
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.vendorAnalyticsService.getSupplierScorecard(
      clinicId,
      supplierId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('suppliers/:supplierId/otif')
  getOtifDetails(
    @TenantId() clinicId: string,
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.vendorAnalyticsService.getOtifDetails(
      clinicId,
      supplierId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('suppliers/:supplierId/quality')
  getQualityMetrics(
    @TenantId() clinicId: string,
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.vendorAnalyticsService.calculateDefectRate(
      clinicId,
      supplierId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }
}
