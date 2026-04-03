import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { UnlinkedItemsService } from './services/unlinked-items.service';
import { VisitFinalizedListener } from './listeners/visit-finalized.listener';
import { ProductController } from './controllers/product.controller';
import { StockController } from './controllers/stock.controller';
import { BranchTestController } from './controllers/branch-test.controller';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';

/**
 * InventoryModule — US4: Inventory & Stock Management
 *
 * Handles: product catalogue CRUD, stock movements (purchase/sale/adjust/waste),
 * immutable StockMovement ledger, reorder threshold alerts (LowStockEvent),
 * inventory report aggregation.
 *
 * Implemented in Phase 6 (T072–T082).
 */
@Module({
  imports: [],
  controllers: [ProductController, StockController, BranchTestController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    ProductService,
    StockService,
    UnlinkedItemsService,
    VisitFinalizedListener,
    BranchContextGuard,
  ],
  exports: [UnlinkedItemsService],
})
export class InventoryModule {}
