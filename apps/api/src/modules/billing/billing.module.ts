import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from './services/invoice.service';
import { TaxEngineService } from './services/tax-engine.service';
import { BillingVisitFinalizedListener } from './listeners/visit-finalized.listener';
import { InvoiceController } from './controllers/invoice.controller';
import { ReportController } from './controllers/report.controller';
import { IdentityModule } from '../identity/identity.module';
import { ClinicalModule } from '../clinical/clinical.module';

/**
 * BillingModule — US5: Billing & Invoicing
 */
@Module({
  imports: [IdentityModule, ClinicalModule],
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
