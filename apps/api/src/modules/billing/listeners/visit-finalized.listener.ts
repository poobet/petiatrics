import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VisitFinalizedEvent } from '../../../common/events/domain-events';
import { InvoiceService } from '../services/invoice.service';

@Injectable()
export class BillingVisitFinalizedListener {
  private readonly logger = new Logger(BillingVisitFinalizedListener.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  @OnEvent('visit.finalized', { async: true })
  async handle(event: VisitFinalizedEvent) {
    try {
      await this.invoiceService.createFromVisitEvent(event);
      this.logger.log(`Draft invoice created for visit ${event.visitId} (clinic ${event.clinicId})`);
    } catch (err) {
      this.logger.error(
        `Failed to auto-create invoice for visit ${event.visitId}: ${(err as Error).message}`,
      );
    }
  }
}
