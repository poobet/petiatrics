import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { ReferenceService } from './services/reference.service';
import { UnlinkedItemsService } from './services/unlinked-items.service';
import { VisitFinalizedListener } from './listeners/visit-finalized.listener';
import { ProductController } from './controllers/product.controller';
import { StockController } from './controllers/stock.controller';
import { ReferenceController } from './controllers/reference.controller';
import { BranchTestController } from './controllers/branch-test.controller';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';

/**
 * InventoryModule — Item Master & Stock Management
 *
 * Handles: clinic item master CRUD (Product), item categories and units (globally seeded
 * reference data), unit conversions, pricing/tax defaults, stock movements, reorder alerts.
 *
 * Extended in 006-item-master to evolve the Product aggregate into the canonical clinic
 * item master with categories, units, pricing, and type-specific rules.
 */
@Module({
  imports: [],
  controllers: [ProductController, StockController, ReferenceController, BranchTestController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    ProductService,
    StockService,
    ReferenceService,
    UnlinkedItemsService,
    VisitFinalizedListener,
    BranchContextGuard,
  ],
  exports: [UnlinkedItemsService, ReferenceService],
})
export class InventoryModule {}

