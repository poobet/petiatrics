import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

@Injectable()
export class StockAlertService {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertAlert(clinicId: string, branchId: string, productId: string): Promise<void> {
    const db = scopedPrisma(this.prisma, clinicId);
    await db.stockAlert.upsert({
      where: {
        clinicId_branchId_productId_alertType: {
          clinicId,
          branchId,
          productId,
          alertType: 'LOW_STOCK',
        },
      },
      update: {
        isActive: true,
        triggeredAt: new Date(),
        resolvedAt: null,
      },
      create: {
        clinicId,
        branchId,
        productId,
        alertType: 'LOW_STOCK',
        isActive: true,
      },
    });
  }

  async resolveAlert(clinicId: string, branchId: string, productId: string): Promise<void> {
    const db = scopedPrisma(this.prisma, clinicId);
    await db.stockAlert.updateMany({
      where: { clinicId, branchId, productId, alertType: 'LOW_STOCK', isActive: true },
      data: { isActive: false, resolvedAt: new Date() },
    });
  }

  async listActive(clinicId: string, branchId?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.stockAlert.findMany({
      where: {
        clinicId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            reorderPoint: true,
            defaultSupplierId: true,
            defaultSupplier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { triggeredAt: 'desc' },
    });
  }
}
