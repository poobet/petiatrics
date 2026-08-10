import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { TaxCodeService, CreateTaxCodePayload, UpdateTaxCodePayload } from '../services/tax-code.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';

@Controller('accounting')
export class TaxCodeController {
  constructor(private readonly taxCodeService: TaxCodeService) {}

  @Get('tax-codes')
  async getTaxCodes(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
  ) {
    const clinicId = tenantId || queryClinicId;
    return this.taxCodeService.getTaxCodes(clinicId);
  }

  @Post('tax-codes')
  async createTaxCode(
    @TenantId() tenantId: string | undefined,
    @Body() payload: CreateTaxCodePayload,
  ) {
    const clinicId = payload.clinicId || tenantId || 'clinic-1';
    return this.taxCodeService.createTaxCode({ ...payload, clinicId });
  }

  @Put('tax-codes/:id')
  async updateTaxCode(
    @Param('id') id: string,
    @Body() payload: UpdateTaxCodePayload,
  ) {
    return this.taxCodeService.updateTaxCode(id, payload);
  }
}
