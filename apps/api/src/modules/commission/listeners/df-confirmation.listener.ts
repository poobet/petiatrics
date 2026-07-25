import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoicePaidEvent } from '../../../common/events/domain-events';
import { DfTransactionService } from '../services/df-transaction.service';

@Injectable()
export class DfConfirmationListener {
  private readonly logger = new Logger(DfConfirmationListener.name);

  constructor(private readonly txService: DfTransactionService) {}

  @OnEvent('invoice.paid', { async: true })
  async handle(event: InvoicePaidEvent) {
    try {
      await this.txService.confirmByInvoiceId(event.clinicId, event.invoiceId);
      this.logger.log(
        `Confirmed DF transactions for invoice ${event.invoiceId} (clinic ${event.clinicId})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to confirm DF for invoice ${event.invoiceId}: ${(err as Error).message}`,
      );
    }
  }
}
