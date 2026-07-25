import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CommissionRuleService } from './services/commission-rule.service';
import { DfCalculationService } from './services/df-calculation.service';
import { DfTransactionService } from './services/df-transaction.service';
import { DfPaymentRunService } from './services/df-payment-run.service';
import { WHTCertificateService } from './services/wht-certificate.service';
import { CommissionRuleController } from './controllers/commission-rule.controller';
import { DfTransactionController } from './controllers/df-transaction.controller';
import { DfPaymentRunController } from './controllers/df-payment-run.controller';
import { WHTCertificateController } from './controllers/wht-certificate.controller';
import { DfAccrualListener } from './listeners/df-accrual.listener';
import { DfConfirmationListener } from './listeners/df-confirmation.listener';
import { DfInvoiceLinkListener } from './listeners/df-invoice-link.listener';
import { DfVoidListener } from './listeners/df-void.listener';

@Module({
  controllers: [
    CommissionRuleController,
    DfTransactionController,
    DfPaymentRunController,
    WHTCertificateController,
  ],
  providers: [
    PrismaClient,
    CommissionRuleService,
    DfCalculationService,
    DfTransactionService,
    DfPaymentRunService,
    WHTCertificateService,
    DfAccrualListener,
    DfConfirmationListener,
    DfInvoiceLinkListener,
    DfVoidListener,
  ],
  exports: [
    CommissionRuleService,
    DfCalculationService,
    DfTransactionService,
    DfPaymentRunService,
    WHTCertificateService,
  ],
})
export class CommissionModule {}
