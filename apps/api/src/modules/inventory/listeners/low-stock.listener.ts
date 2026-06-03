import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LowStockEvent } from '../../../common/events/domain-events';
import { StockAlertService } from '../services/stock-alert.service';

@Injectable()
export class LowStockListener {
  private readonly logger = new Logger(LowStockListener.name);

  constructor(private readonly alertService: StockAlertService) {}

  @OnEvent('stock.low_stock_warning', { async: true })
  async handleLowStock(event: LowStockEvent): Promise<void> {
    this.logger.warn(
      `[LOW STOCK] clinic=${event.clinicId} branch=${event.branchId} ` +
        `product=${event.productId} (${event.productName}) ` +
        `sku=${event.sku ?? 'N/A'} ` +
        `qty=${event.currentQuantity} reorderPoint=${event.reorderPoint} ` +
        `minimumStock=${event.minimumStock}`,
    );
    await this.alertService.upsertAlert(event.clinicId, event.branchId, event.productId);
  }
}
