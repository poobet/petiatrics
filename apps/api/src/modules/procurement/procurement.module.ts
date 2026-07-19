import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PurchaseOrderService } from './services/purchase-order.service';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { PurchaseInvoiceService } from './services/purchase-invoice.service';
import { ThreeWayMatchingService } from './services/three-way-matching.service';
import { SupplierPaymentService } from './services/supplier-payment.service';
import { VendorAnalyticsService } from './services/vendor-analytics.service';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { GoodsReceiptController } from './controllers/goods-receipt.controller';
import { PurchaseInvoiceController } from './controllers/purchase-invoice.controller';
import { SupplierPaymentController } from './controllers/supplier-payment.controller';
import { VendorAnalyticsController } from './controllers/vendor-analytics.controller';

import { DocumentSequenceModule } from '../document-sequence/document-sequence.module';

@Module({
  imports: [DocumentSequenceModule],
  controllers: [
    PurchaseOrderController,
    GoodsReceiptController,
    PurchaseInvoiceController,
    SupplierPaymentController,
    VendorAnalyticsController,
  ],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient();
      },
    },
    PurchaseOrderService,
    GoodsReceiptService,
    PurchaseInvoiceService,
    ThreeWayMatchingService,
    SupplierPaymentService,
    VendorAnalyticsService,
  ],
  exports: [
    PurchaseOrderService,
    GoodsReceiptService,
    PurchaseInvoiceService,
    SupplierPaymentService,
    VendorAnalyticsService,
  ],
})
export class ProcurementModule {}
