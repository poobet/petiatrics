import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingModule } from '../billing/billing.module';
import { SystemRuleService } from './services/system-rule.service';
import { RuleEvaluatorService } from './services/rule-evaluator.service';
import { GlAccountService } from './services/gl-account.service';
import { InventoryGlListener } from './listeners/inventory-gl.listener';
import { SystemRuleController } from './controllers/system-rule.controller';

/**
 * AccountingModule — Phase 1: Perpetual Inventory & GL Integration
 *
 * Owns:
 * - SystemRule CRUD (dynamic GL mapping rules)
 * - RuleEvaluatorService (JSON condition matching engine)
 * - GlAccountService (Chart of Accounts & System Account Protection)
 * - InventoryGlListener (event handlers → GL journal posting)
 *
 * Reuses GLPostingService from BillingModule for balanced journal entry creation.
 */
@Module({
  imports: [BillingModule],
  controllers: [SystemRuleController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    SystemRuleService,
    RuleEvaluatorService,
    GlAccountService,
    InventoryGlListener,
  ],
  exports: [RuleEvaluatorService, SystemRuleService, GlAccountService],
})
export class AccountingModule {}
