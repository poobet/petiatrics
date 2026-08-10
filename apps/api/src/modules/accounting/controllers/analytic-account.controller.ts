import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AnalyticAccountService, CreateAnalyticAccountPayload } from '../services/analytic-account.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';

@Controller('accounting')
export class AnalyticAccountController {
  constructor(private readonly analyticAccountService: AnalyticAccountService) {}

  @Get('analytic-accounts')
  async getAnalyticAccounts(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
  ) {
    const clinicId = tenantId || queryClinicId || 'clinic-1';
    return this.analyticAccountService.getAnalyticAccounts(clinicId);
  }

  @Post('analytic-accounts')
  async createAnalyticAccount(
    @TenantId() tenantId: string | undefined,
    @Body() payload: CreateAnalyticAccountPayload,
  ) {
    const clinicId = payload.clinicId || tenantId || 'clinic-1';
    return this.analyticAccountService.createAnalyticAccount({ ...payload, clinicId });
  }
}
