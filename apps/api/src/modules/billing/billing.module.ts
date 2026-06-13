import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from './services/invoice.service';
import { TaxEngineService } from './services/tax-engine.service';
import { BillingVisitFinalizedListener } from './listeners/visit-finalized.listener';
import { InvoiceController } from './controllers/invoice.controller';
import { ReportController } from './controllers/report.controller';

/**
 * BillingModule — US5: Billing & Invoicing
 *
 * Handles: invoice generation from visit records + products, line items
 * (service/product/discount/tax), invoice lifecycle (draft → sent → paid → voided),
 * payment recording, VAT calculation (7% Thailand), InvoiceCreatedEvent/InvoicePaidEvent
 * emission. All monetary values kept in minor units (satang).
 *
 * Implemented in Phase 7 (T083–T090).
 */
@Module({
  imports: [],
  controllers: [InvoiceController, ReportController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    TaxEngineService,
    InvoiceService,
    BillingVisitFinalizedListener,
  ],
  exports: [TaxEngineService],
})
export class BillingModule {}
