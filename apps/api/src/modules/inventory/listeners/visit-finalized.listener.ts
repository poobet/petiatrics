import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { VisitFinalizedEvent } from '../../../common/events/domain-events';
import { StockService } from '../services/stock.service';

/**
 * Listens for VisitFinalizedEvent and auto-deducts inventory
 * for all inventory-linked prescriptions in the visit.
 *
 * Unlinked prescription items (productId = null/undefined) are skipped.
 */
@Injectable()
export class VisitFinalizedListener {
  private readonly logger = new Logger(VisitFinalizedListener.name);

  constructor(private readonly stockService: StockService) {}

  @OnEvent('visit.finalized', { async: true })
  async handleVisitFinalized(event: VisitFinalizedEvent): Promise<void> {
    if (!event.productIds || event.productIds.length === 0) {
      return;
    }

    for (const productId of event.productIds) {
      try {
        await this.stockService.deduct(event.clinicId, {
          productId,
          quantity: 1, // default: 1 unit per dispense; pharmacist quantity override in future
          visitRecordId: event.visitId,
          actorId: event.vetId,
        });
        this.logger.log(
          `Auto-deducted product ${productId} for visit ${event.visitId} in clinic ${event.clinicId}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Log but don't throw — don't block the response if one product fails
        this.logger.warn(
          `Failed to deduct product ${productId} for visit ${event.visitId}: ${msg}`,
        );
      }
    }
  }
}
