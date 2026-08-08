import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { StockAlertService } from './services/stock-alert.service';
import { ReferenceService } from './services/reference.service';
import { UnlinkedItemsService } from './services/unlinked-items.service';
import { InventoryWriteGuardService } from './services/inventory-write-guard.service';
import { SkuSequenceService } from './services/sku-sequence.service';
import { BulkImportService } from './services/bulk-import.service';
import { LowStockListener } from './listeners/low-stock.listener';
import { ProductController } from './controllers/product.controller';
import { StockController } from './controllers/stock.controller';
import { ReferenceController } from './controllers/reference.controller';
import { BranchTestController } from './controllers/branch-test.controller';
import { BulkImportController } from './controllers/bulk-import.controller';
import { StockAdjustmentController } from './controllers/stock-adjustment.controller';
import { StockAlertController } from './controllers/stock-alert.controller';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { StockAdjustmentService } from './services/stock-adjustment.service';
import { InventoryLocationService } from './services/inventory-location.service';
import { InventoryLocationController } from './controllers/inventory-location.controller';
import { ReasonCodeService } from './services/reason-code.service';
import { ReasonCodeController } from './controllers/reason-code.controller';

@Module({
  imports: [MulterModule.register({ dest: '/tmp' })],
  controllers: [
    ProductController,
    StockController,
    ReferenceController,
    BranchTestController,
    BulkImportController,
    StockAdjustmentController,
    StockAlertController,
    InventoryLocationController,
    ReasonCodeController,
  ],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    ProductService,
    SkuSequenceService,
    BulkImportService,
    StockService,
    StockAlertService,
    StockAdjustmentService,
    InventoryLocationService,
    ReasonCodeService,
    ReferenceService,
    UnlinkedItemsService,
    InventoryWriteGuardService,
    BranchContextGuard,
    LowStockListener,
  ],
  exports: [
    UnlinkedItemsService,
    ReferenceService,
    StockService,
    StockAlertService,
    InventoryWriteGuardService,
    InventoryLocationService,
    ReasonCodeService,
  ],
})
export class InventoryModule {}


