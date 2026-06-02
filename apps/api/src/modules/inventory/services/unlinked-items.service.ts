import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

/**
 * Detects prescription items that reference drugs not linked to an inventory product.
 * These are represented by prescriptions where `inventoryLinked === false`.
 * A clinic manager can review and optionally link them to products.
 *
 * Note: The actual unlinked prescription data lives in MongoDB VisitRecords.
 * This service queries via a dedicated endpoint for the Manager dashboard.
 */
@Injectable()
export class UnlinkedItemsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns a simple count of low-stock products for the dashboard badge.
   * Full unlinked visit-level records would require MongoDB aggregation (future enhancement).
   */
  async getLowStockSummary(clinicId: string): Promise<{ count: number; productNames: string[] }> {
    const db = scopedPrisma(this.prisma, clinicId);
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { name: true, quantity: true, reorderPoint: true },
    });
    const low = products.filter(
      (p: any) => Number(p.quantity) <= Number(p.reorderPoint),
    );
    return {
      count: low.length,
      productNames: low.map((p: any) => p.name),
    };
  }
}
