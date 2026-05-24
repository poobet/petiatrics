import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LowStockEvent } from '../../../common/events/domain-events';

/**
 * LowStockListener
 *
 * Listens for the 'stock.low_stock_warning' event emitted by StockService.deduct()
 * and logs a structured warning. Future enhancements can add push notifications,
 * email alerts, or real-time websocket broadcasts from here.
 */
@Injectable()
export class LowStockListener {
  private readonly logger = new Logger(LowStockListener.name);

  @OnEvent('stock.low_stock_warning', { async: true })
  handleLowStock(event: LowStockEvent): void {
    this.logger.warn(
      `[LOW STOCK] clinic=${event.clinicId} branch=${event.branchId} ` +
        `product=${event.productId} (${event.productName}) ` +
        `sku=${event.sku ?? 'N/A'} ` +
        `qty=${event.currentQuantity} reorderPoint=${event.reorderPoint} ` +
        `minimumStock=${event.minimumStock}`,
    );
  }
}
