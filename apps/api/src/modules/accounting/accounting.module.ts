import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingModule } from '../billing/billing.module';
import { SystemRuleService } from './services/system-rule.service';
import { RuleEvaluatorService } from './services/rule-evaluator.service';
import { GlAccountService } from './services/gl-account.service';
import { JournalService } from './services/journal.service';
import { InventoryGlListener } from './listeners/inventory-gl.listener';
import { SystemRuleController } from './controllers/system-rule.controller';
import { GlAccountController } from './controllers/gl-account.controller';

/**
 * AccountingModule — Phase 1: Perpetual Inventory & GL Integration
 *
 * Owns:
 * - SystemRule CRUD (dynamic GL mapping rules)
 * - RuleEvaluatorService (JSON condition matching engine)
 * - GlAccountService (Chart of Accounts & System Account Protection)
 * - JournalService (Balanced Double-Entry Journal Entries)
 * - InventoryGlListener (event handlers → GL journal posting)
 */
@Module({
  imports: [BillingModule],
  controllers: [SystemRuleController, GlAccountController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    SystemRuleService,
    RuleEvaluatorService,
    GlAccountService,
    JournalService,
    InventoryGlListener,
  ],
  exports: [RuleEvaluatorService, SystemRuleService, GlAccountService, JournalService],
})
export class AccountingModule {}
