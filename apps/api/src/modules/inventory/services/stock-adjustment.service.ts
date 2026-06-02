import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LowStockEvent } from '../../../common/events/domain-events';
import { SubmitAdjustmentDto } from '../dto/submit-adjustment.dto';
import { RejectAdjustmentDto } from '../dto/reject-adjustment.dto';

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Submit a stock adjustment for manager review.
   * Creates a PENDING_APPROVAL StockMovement; does NOT update BranchStockBalance.
   */
  async submitAdjustment(clinicId: string, branchId: string, actorId: string, dto: SubmitAdjustmentDto) {
    const db = scopedPrisma(this.prisma, clinicId);

    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);

    // Find the current balance for the lot in the securely extracted branch
    const balance = await db.branchStockBalance.findFirst({
      where: {
        clinicId,
        branchId,
        productId: dto.productId,
        lotNumber: dto.lotNumber ?? null,
      },
    });

    const currentQty = balance ? Number(balance.quantity) : 0;
    const delta = dto.physicalCount - currentQty;

    const movement = await this.prisma.stockMovement.create({
      data: {
        clinicId,
        branchId,
        productId: dto.productId,
        delta,
        quantityBefore: currentQty,
        quantityAfter: dto.physicalCount,
        reason: 'MANUAL_ADJUSTMENT',
        referenceType: 'MANUAL',
        referenceId: `ADJ-${Date.now()}`,
        actorId,
        lotNumber: dto.lotNumber ?? null,
        reasonCode: dto.reasonCode ?? null,
        overrideReason: dto.notes ?? null,
        status: 'PENDING_APPROVAL',
      },
    });

    return { id: movement.id, status: 'PENDING_APPROVAL', delta, currentQty, physicalCount: dto.physicalCount };
  }

  /**
   * Approve a pending adjustment.
   * Updates the BranchStockBalance and marks the movement as COMMITTED.
   */
  async approveAdjustment(clinicId: string, approverId: string, movementId: string) {
    const db = scopedPrisma(this.prisma, clinicId);

    const movement = await db.stockMovement.findFirst({
      where: { id: movementId, clinicId, status: 'PENDING_APPROVAL' },
      select: {
        id: true,
        branchId: true,
        productId: true,
        delta: true,
        lotNumber: true,
        quantityAfter: true,
      },
    });
    if (!movement) throw new NotFoundException(`Pending adjustment ${movementId} not found.`);
    if (!movement.branchId) {
      console.log('Fetched Adjustment:', movement);
      throw new BadRequestException('Adjustment record is missing branch information.');
    }
    const branchId = movement.branchId;

    const product = await db.product.findUnique({ where: { id: movement.productId } });

    return this.prisma.$transaction(async (tx: any) => {
      // Upsert balance row
      const existing = await tx.branchStockBalance.findFirst({
        where: {
          clinicId,
          branchId,
          productId: movement.productId,
          lotNumber: movement.lotNumber,
        },
      });

      let newQty: number;
      if (existing) {
        const updated = await tx.branchStockBalance.update({
          where: { id: existing.id },
          data: { quantity: { increment: Number(movement.delta) }, version: { increment: 1 } },
        });
        newQty = Number(updated.quantity);
      } else {
        // Create new balance row (initial count from zero)
        const created = await tx.branchStockBalance.create({
          data: {
            clinicId,
            branchId,
            productId: movement.productId,
            lotNumber: movement.lotNumber,
            quantity: Number(movement.quantityAfter),
            version: 0,
          },
        });
        newQty = Number(created.quantity);
      }

      const committed = await tx.stockMovement.update({
        where: { id: movementId },
        data: { status: 'COMMITTED', approverId },
      });

      // Alert check
      if (product) {
        const reorderPoint = Number(product.reorderPoint);
        if (reorderPoint > 0 && newQty <= reorderPoint) {
          this.events.emit(
            'stock.low_stock_warning',
            new LowStockEvent(
              clinicId,
              branchId,
              movement.productId,
              product.name,
              newQty,
              reorderPoint,
              product.sku ?? null,
              Number(product.minimumStock),
            ),
          );
        }
      }

      return { id: committed.id, status: 'COMMITTED', newBalance: newQty };
    });
  }

  /**
   * Reject a pending adjustment.
   * Sets status to REJECTED; balance is NOT modified.
   */
  async rejectAdjustment(clinicId: string, approverId: string, movementId: string, dto: RejectAdjustmentDto) {
    const db = scopedPrisma(this.prisma, clinicId);

    const movement = await db.stockMovement.findFirst({
      where: { id: movementId, clinicId, status: 'PENDING_APPROVAL' },
    });
    if (!movement) throw new NotFoundException(`Pending adjustment ${movementId} not found.`);

    const rejected = await this.prisma.stockMovement.update({
      where: { id: movementId },
      data: { status: 'REJECTED', approverId, overrideReason: dto.rejectionReason },
    });

    return { id: rejected.id, status: 'REJECTED' };
  }

  /**
   * List all pending adjustments for a clinic (optionally filtered by branch).
   */
  async listPendingAdjustments(clinicId: string, branchId?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.stockMovement.findMany({
      where: {
        clinicId,
        status: 'PENDING_APPROVAL',
        reason: 'MANUAL_ADJUSTMENT',
        ...(branchId ? { branchId } : {}),
      },
      include: {
        product: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
