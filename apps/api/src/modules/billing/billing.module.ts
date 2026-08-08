import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from './services/invoice.service';
import { TaxEngineService } from './services/tax-engine.service';
import { PaymentService } from './services/payment.service';
import { GLPostingService } from './services/gl-posting.service';
import { CustomerDepositService } from './services/customer-deposit.service';
import { CashierSessionService } from './services/cashier-session.service';
import { BillingVisitFinalizedListener } from './listeners/visit-finalized.listener';
import { InvoiceController } from './controllers/invoice.controller';
import { ReportController } from './controllers/report.controller';
import { PaymentController } from './controllers/payment.controller';
import { IdentityModule } from '../identity/identity.module';
import { ClinicalModule } from '../clinical/clinical.module';
import { DocumentSequenceModule } from '../document-sequence/document-sequence.module';
import { CommissionModule } from '../commission/commission.module';

/**
 * BillingModule — US5: Billing & Invoicing
 */
@Module({
  imports: [IdentityModule, ClinicalModule, DocumentSequenceModule, CommissionModule],
  controllers: [InvoiceController, ReportController, PaymentController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    TaxEngineService,
    InvoiceService,
    PaymentService,
    GLPostingService,
    CustomerDepositService,
    CashierSessionService,
    BillingVisitFinalizedListener,
  ],
  exports: [TaxEngineService, PaymentService, GLPostingService, CustomerDepositService, CashierSessionService],
})
export class BillingModule {}
