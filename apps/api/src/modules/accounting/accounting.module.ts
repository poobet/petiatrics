import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingModule } from '../billing/billing.module';
import { DocumentSequenceModule } from '../document-sequence/document-sequence.module';
import { SystemRuleService } from './services/system-rule.service';
import { RuleEvaluatorService } from './services/rule-evaluator.service';
import { GlAccountService } from './services/gl-account.service';
import { JournalService } from './services/journal.service';
import { InventoryGlListener } from './listeners/inventory-gl.listener';
import { SystemRuleController } from './controllers/system-rule.controller';
import { GlAccountController } from './controllers/gl-account.controller';
import { JournalController } from './controllers/journal.controller';

import { JournalValidationEngine } from './engines/journal-validation.engine';
import { TaxCalculatorEngine } from './engines/tax-calculator.engine';

/**
 * AccountingModule — Phase 1: Accounting Foundation & Chart of Accounts
 */
@Module({
  imports: [BillingModule, DocumentSequenceModule],
  controllers: [SystemRuleController, GlAccountController, JournalController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    SystemRuleService,
    RuleEvaluatorService,
    GlAccountService,
    JournalService,
    JournalValidationEngine,
    TaxCalculatorEngine,
    InventoryGlListener,
  ],
  exports: [
    RuleEvaluatorService,
    SystemRuleService,
    GlAccountService,
    JournalService,
    JournalValidationEngine,
    TaxCalculatorEngine,
  ],
})
export class AccountingModule {}
