import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
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
import { BranchContextGuard } from '../../common/guards/branch-context.guard';

@Module({
  imports: [MulterModule.register({ dest: '/tmp' })],
  controllers: [ProductController, StockController, ReferenceController, BranchTestController, BulkImportController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    ProductService,
    SkuSequenceService,
    BulkImportService,
    StockService,
    ReferenceService,
    UnlinkedItemsService,
    InventoryWriteGuardService,
    BranchContextGuard,
    LowStockListener,
  ],
  exports: [UnlinkedItemsService, ReferenceService, StockService, InventoryWriteGuardService],
})
export class InventoryModule {}

