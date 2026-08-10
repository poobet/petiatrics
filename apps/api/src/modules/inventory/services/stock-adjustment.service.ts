import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LowStockEvent } from '../../../common/events/domain-events';
import { StockAdjustedEvent } from '../../../common/events/stock-adjusted.event';
import { SubmitAdjustmentDto } from '../dto/submit-adjustment.dto';
import { RejectAdjustmentDto } from '../dto/reject-adjustment.dto';

export interface CreateStockAdjustmentDto {
  productId: string;
  quantity: number; // Positive for surplus, negative for deficit
  reasonCodeId: string;
  notes?: string;
  locationId?: string;
}

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Performs a stock adjustment compliant with Thai Revenue Department standards.
   * 
   * Compliance Rules:
   * 1. LCNRV (Expired Goods): Marked as EXPIRED -> Mapped to "Loss on NRV / Write-Off" expense.
   * 2. Inventory Shortage (Deemed Sale under Thai VAT Law Sec 77/1(8)(e)):
   *    Marked as MISSING_UNKNOWN -> System sets requiresVatCalculation: true to trigger Output VAT (ภาษีขาย).
   */
  async createAdjustment(
    clinicId: string,
    branchId: string,
    userId: string,
    dto: CreateStockAdjustmentDto,
  ) {
    // 1. Validate mandatory ReasonCode (Free-text reasons are FORBIDDEN)
    const reasonCode = await this.prisma.reasonCode.findFirst({
      where: {
        id: dto.reasonCodeId,
        clinicId,
        isActive: true,
      },
    });

    if (!reasonCode) {
      throw new BadRequestException(
        `Invalid or inactive ReasonCode ID: "${dto.reasonCodeId}". Stock adjustments must reference a valid master data ReasonCode.`,
      );
    }

    // 2. Fetch Product & Current Costing (Moving Average Cost in Satang)
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, clinicId },
      include: {
        branchSettings: {
          where: { branchId },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ID "${dto.productId}" not found.`);
    }

    // Determine unit cost (Satang): branch-specific moving average cost or base product cost
    const branchSetting = product.branchSettings[0];
    const unitCostSatang = branchSetting
      ? Math.round(Number(branchSetting.movingAverageCost) * 100)
      : Math.round(Number(product.standardCost) * 100);

    const totalCostSatang = Math.abs(Math.round(unitCostSatang * dto.quantity));

    // 3. Execute Transaction: Record Adjustment & Update Stock Ledger
    const result = await this.prisma.$transaction(async (tx) => {
      // Record Stock Adjustment
      const adjustment = await tx.stockAdjustment.create({
        data: {
          clinicId,
          branchId,
          productId: dto.productId,
          quantity: dto.quantity,
          unitCostMinor: unitCostSatang,
          totalCostMinor: totalCostSatang,
          reasonCodeId: reasonCode.id,
          adjustedBy: userId,
          notes: dto.notes,
          status: 'COMMITTED',
        },
      });

      // Update Branch Stock Balance atomically
      const existingBalance = await tx.branchStockBalance.findFirst({
        where: {
          clinicId,
          branchId,
          productId: dto.productId,
          locationId: dto.locationId ?? null,
          lotNumber: null,
        },
      });

      if (existingBalance) {
        await tx.branchStockBalance.update({
          where: { id: existingBalance.id },
          data: {
            quantity: { increment: dto.quantity },
            version: { increment: 1 },
          },
        });
      } else {
        await tx.branchStockBalance.create({
          data: {
            clinicId,
            branchId,
            productId: dto.productId,
            locationId: dto.locationId ?? null,
            quantity: dto.quantity,
            version: 0,
          },
        });
      }

      return adjustment;
    });

    // 4. Emit Domain Event for Accounting Rule Engine & GL Posting
    const eventPayload = new StockAdjustedEvent(
      clinicId,
      branchId,
      result.id,
      dto.productId,
      dto.quantity,
      unitCostSatang,
      totalCostSatang,
      reasonCode.id,
      reasonCode.code,
      reasonCode.requiresVatCalculation,
      reasonCode.type,
      userId,
      new Date(),
    );

    this.events.emit('inventory.stock_adjusted', eventPayload);

    return result;
  }

  /**
   * Submit a stock adjustment for manager review.
   * Creates a PENDING_APPROVAL StockMovement; does NOT update BranchStockBalance.
   */
  async submitAdjustment(clinicId: string, branchId: string, actorId: string, dto: SubmitAdjustmentDto) {
    const db = scopedPrisma(this.prisma, clinicId);

    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);

    // Normalize lot number: empty or whitespace becomes null
    const lotNumber = dto.lotNumber?.trim() ? dto.lotNumber.trim() : null;

    // Validate that lot-controlled items MUST have a lot number
    if (product.requiresBatchAndExpiryTracking && !lotNumber) {
      throw new BadRequestException(`Lot number is required for batch-tracked product "${product.name}".`);
    }

    // Find the current balance for the lot in the securely extracted branch
    const balance = await db.branchStockBalance.findFirst({
      where: {
        clinicId,
        branchId,
        productId: dto.productId,
        lotNumber,
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
        lotNumber,
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

