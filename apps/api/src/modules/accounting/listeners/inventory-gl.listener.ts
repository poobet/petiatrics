import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { GoodsReceiptCompletedEvent, GoodsIssuedEvent } from '../../../common/events/domain-events';
import { GLPostingService } from '../../billing/services/gl-posting.service';
import { RuleEvaluatorService } from '../services/rule-evaluator.service';

/** Default GL account codes for perpetual inventory */
const GL_DEFAULTS = {
  INVENTORY_ASSET: '1310',
  ACCOUNTS_PAYABLE: '2110',
  COGS: '5110',
  WRITE_DOWN_LOSS: '5290',
  REVENUE: '4110',
} as const;

/**
 * Listens to inventory domain events and creates GL journal entries.
 *
 * Flow:
 * 1. Check hard compliance rules (cannot be overridden by dynamic rules)
 * 2. Evaluate dynamic rules from SystemRule table
 * 3. Fall back to default GL account mappings
 * 4. Create balanced journal entry via GLPostingService
 */
@Injectable()
export class InventoryGlListener {
  private readonly logger = new Logger(InventoryGlListener.name);

  constructor(
    private readonly glPostingService: GLPostingService,
    private readonly ruleEvaluator: RuleEvaluatorService,
    private readonly prisma: PrismaClient,
  ) {}

  // ─── Goods Receipt: Dr. Inventory Asset, Cr. Accounts Payable ──────────────

  @OnEvent('inventory.goods_receipt_completed', { async: true })
  async handleGoodsReceipt(event: GoodsReceiptCompletedEvent): Promise<void> {
    try {
      const totalMinor = event.quantity * event.unitCostMinor;
      if (totalMinor === 0) {
        this.logger.warn(
          `Skipping GL posting for zero-value goods receipt: product=${event.productId}`,
        );
        return;
      }

      // Evaluate dynamic rules (may override default accounts)
      const payload = this.eventToPayload(event);
      const ruleResult = await this.ruleEvaluator.evaluate(
        'inventory.goods_receipt_completed',
        payload,
        event.clinicId,
      );

      const debitCode = ruleResult.action?.debitAccountCode ?? GL_DEFAULTS.INVENTORY_ASSET;
      const creditCode = ruleResult.action?.creditAccountCode ?? GL_DEFAULTS.ACCOUNTS_PAYABLE;

      // Check if rule requires manual review before auto-posting
      if (ruleResult.matched && (ruleResult.action?.autoPost === false || ruleResult.action?.requireApproval === true)) {
        this.logger.log(
          `GL posting requires manual review [Rule: ${ruleResult.ruleName}]. Held in PENDING_REVIEW for ref=${event.referenceId}`,
        );
        return;
      }

      const debitAccount = await this.resolveGlAccount(debitCode);
      const creditAccount = await this.resolveGlAccount(creditCode);

      await this.glPostingService.postJournal(event.clinicId, {
        type: 'INVENTORY',
        description: `Goods Receipt – product ${event.productId}, qty ${event.quantity}${ruleResult.matched ? ` [Rule: ${ruleResult.ruleName}]` : ''}`,
        sourceRefType: 'GOODS_RECEIPT',
        sourceRefId: event.referenceId,
        lines: [
          { glAccountId: debitAccount.id, debitMinor: totalMinor, creditMinor: 0 },
          { glAccountId: creditAccount.id, debitMinor: 0, creditMinor: totalMinor },
        ],
      });

      this.logger.log(
        `GL posted for goods receipt: Dr. ${debitCode} / Cr. ${creditCode} ` +
          `amount=${totalMinor} product=${event.productId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to post GL for goods receipt: product=${event.productId} – ${(err as Error).message}`,
      );
    }
  }

  // ─── Goods Issue: Dr. COGS (or override), Cr. Inventory Asset ──────────────

  @OnEvent('inventory.goods_issued', { async: true })
  async handleGoodsIssued(event: GoodsIssuedEvent): Promise<void> {
    try {
      const totalMinor = event.quantity * event.unitCostMinor;
      if (totalMinor === 0) {
        this.logger.warn(
          `Skipping GL posting for zero-value goods issue: product=${event.productId}`,
        );
        return;
      }

      let debitCode: string;
      let creditCode: string;
      let ruleDescription = '';

      // ══════════════════════════════════════════════════════════════════════
      // HARD RULE — COMPLIANCE OVERRIDE (cannot be bypassed by dynamic rules)
      //
      // Tax compliance: "Inventory Shortages" without justified reason are
      // treated as deemed sales, subject to VAT/CIT.
      // Dr. Revenue (4110) / Cr. Inventory Asset (1310)
      // ══════════════════════════════════════════════════════════════════════
      if (event.reasonCode === 'SHRINKAGE') {
        debitCode = GL_DEFAULTS.REVENUE;
        creditCode = GL_DEFAULTS.INVENTORY_ASSET;
        ruleDescription = ' [HARD RULE: Shortage treated as deemed sale]';
      } else {
        // Evaluate dynamic rules
        const payload = this.eventToPayload(event);
        const ruleResult = await this.ruleEvaluator.evaluate(
          'inventory.goods_issued',
          payload,
          event.clinicId,
        );

        // Check if rule requires manual review before auto-posting
        if (ruleResult.matched && (ruleResult.action?.autoPost === false || ruleResult.action?.requireApproval === true)) {
          this.logger.log(
            `GL posting requires manual review [Rule: ${ruleResult.ruleName}]. Held in PENDING_REVIEW for ref=${event.referenceId}`,
          );
          return;
        }

        debitCode = ruleResult.action?.debitAccountCode ?? GL_DEFAULTS.COGS;
        creditCode = ruleResult.action?.creditAccountCode ?? GL_DEFAULTS.INVENTORY_ASSET;
        if (ruleResult.matched) {
          ruleDescription = ` [Rule: ${ruleResult.ruleName}]`;
        }
      }

      const debitAccount = await this.resolveGlAccount(debitCode);
      const creditAccount = await this.resolveGlAccount(creditCode);

      await this.glPostingService.postJournal(event.clinicId, {
        type: 'INVENTORY',
        description: `Goods Issue – product ${event.productId}, qty ${event.quantity}${ruleDescription}`,
        sourceRefType: 'GOODS_ISSUE',
        sourceRefId: event.referenceId,
        lines: [
          { glAccountId: debitAccount.id, debitMinor: totalMinor, creditMinor: 0 },
          { glAccountId: creditAccount.id, debitMinor: 0, creditMinor: totalMinor },
        ],
      });

      this.logger.log(
        `GL posted for goods issue: Dr. ${debitCode} / Cr. ${creditCode} ` +
          `amount=${totalMinor} product=${event.productId}${ruleDescription}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to post GL for goods issue: product=${event.productId} – ${(err as Error).message}`,
      );
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private eventToPayload(
    event: GoodsReceiptCompletedEvent | GoodsIssuedEvent,
  ): Record<string, unknown> {
    return {
      clinicId: event.clinicId,
      branchId: event.branchId,
      productId: event.productId,
      quantity: event.quantity,
      unitCostMinor: event.unitCostMinor,
      reasonCode: event.reasonCode,
      referenceId: event.referenceId,
      referenceType: event.referenceType,
    };
  }

  private async resolveGlAccount(code: string) {
    const account = await this.prisma.gLAccount.findUnique({
      where: { code },
    });
    if (!account) {
      throw new Error(`GL Account with code "${code}" not found. Ensure seed data is loaded.`);
    }
    return account;
  }
}
