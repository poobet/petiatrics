import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PurchaseOrderService } from './services/purchase-order.service';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { GoodsReceiptController } from './controllers/goods-receipt.controller';

import { DocumentSequenceModule } from '../document-sequence/document-sequence.module';

@Module({
  imports: [DocumentSequenceModule],
  controllers: [PurchaseOrderController, GoodsReceiptController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient();
      },
    },
    PurchaseOrderService,
    GoodsReceiptService,
  ],
  exports: [PurchaseOrderService, GoodsReceiptService],
})
export class ProcurementModule {}
