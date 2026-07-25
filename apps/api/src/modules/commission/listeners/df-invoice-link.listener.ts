import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceCreatedEvent } from '../../../common/events/domain-events';
import { DfTransactionService } from '../services/df-transaction.service';

@Injectable()
export class DfInvoiceLinkListener {
  private readonly logger = new Logger(DfInvoiceLinkListener.name);

  constructor(private readonly txService: DfTransactionService) {}

  @OnEvent('invoice.created', { async: true })
  async handle(event: InvoiceCreatedEvent) {
    if (!event.visitId) return;

    try {
      await this.txService.backfillInvoiceId(
        event.clinicId,
        event.visitId,
        event.invoiceId,
      );
      this.logger.log(
        `Linked invoice ${event.invoiceId} to visit ${event.visitId} DF transactions`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to link invoice ${event.invoiceId} to visit ${event.visitId}: ${(err as Error).message}`,
      );
    }
  }
}
