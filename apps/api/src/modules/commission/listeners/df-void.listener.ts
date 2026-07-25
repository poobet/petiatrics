import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceVoidedEvent } from '../../../common/events/domain-events';
import { DfTransactionService } from '../services/df-transaction.service';

@Injectable()
export class DfVoidListener {
  private readonly logger = new Logger(DfVoidListener.name);

  constructor(private readonly txService: DfTransactionService) {}

  @OnEvent('invoice.voided', { async: true })
  async handle(event: InvoiceVoidedEvent) {
    try {
      await this.txService.voidByInvoiceId(
        event.clinicId,
        event.invoiceId,
        event.voidReason,
      );
      this.logger.log(
        `Voided DF transactions for invoice ${event.invoiceId} (clinic ${event.clinicId})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to void DF for invoice ${event.invoiceId}: ${(err as Error).message}`,
      );
    }
  }
}
