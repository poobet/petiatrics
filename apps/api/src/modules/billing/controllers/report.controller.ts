import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { InvoiceService } from '../services/invoice.service';

@Controller('billing/reports')
export class ReportController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @Roles(Role.CLINIC_OWNER)
  getReport(
    @TenantId() clinicId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.invoiceService.getReport(clinicId, fromDate, toDate);
  }
}
