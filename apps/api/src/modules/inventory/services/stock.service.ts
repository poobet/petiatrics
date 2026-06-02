import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { LowStockEvent } from '../../../common/events/domain-events';
import { InventoryWriteGuardService } from './inventory-write-guard.service';
import { StockAlertService } from './stock-alert.service';
import { GoodsReceiptDto } from '../dto/goods-receipt.dto';
import { GoodsIssueDto } from '../dto/goods-issue.dto';

export interface ReplenishDto {
  branchId: string;
  productId: string;
  quantity: number;
  referenceId: string;
  actorId: string;
}

export interface DeductDto {
  branchId: string;
  productId: string;
  quantity: number;
  visitRecordId: string;
  actorId: string;
  idempotencyKey?: string;
}

@Injectable()
export class StockService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
    private readonly writeGuard: InventoryWriteGuardService,
    private readonly alertService: StockAlertService,
  ) {}

  async replenish(clinicId: string, dto: ReplenishDto) {
    this.writeGuard.assertWritable();
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    return this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.branchStockBalance.findUnique({
        where: {
          clinicId_branchId_productId: {
            clinicId,
            branchId: dto.branchId,
            productId: dto.productId,
          },
        },
      });

      let balance: { id: string; quantity: number };
      if (existing) {
        balance = existing;
      } else {
        balance = await tx.branchStockBalance.upsert({
          where: {
            clinicId_branchId_productId: {
              clinicId,
              branchId: dto.branchId,
              productId: dto.productId,
            },
          },
          update: {},
          create: {
            clinicId,
            branchId: dto.branchId,
            productId: dto.productId,
            quantity: 0,
          },
        });
      }

      const qBefore = Number(balance.quantity);
      const qAfter = qBefore + dto.quantity;

      const updatedBalance = await tx.branchStockBalance.update({
        where: { id: balance.id },
        data: { quantity: qAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          clinicId,
          branchId: dto.branchId,
          productId: dto.productId,
          delta: dto.quantity,
          quantityBefore: qBefore,
          quantityAfter: qAfter,
          reason: 'REPLENISH',
          referenceType: 'REPLENISHMENT',
          referenceId: dto.referenceId,
          actorId: dto.actorId,
        },
      });

      return { balance: updatedBalance, movement };
    });
  }

  async deduct(clinicId: string, dto: DeductDto) {
    this.writeGuard.assertWritable();
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    return this.prisma.$transaction(async (tx: any) => {
      const balance = await tx.branchStockBalance.findUnique({
        where: {
          clinicId_branchId_productId: {
            clinicId,
            branchId: dto.branchId,
            productId: dto.productId,
          },
        },
      });

      if (!balance) {
        throw new BadRequestException(
          `No stock balance found for product "${product.name}" in this branch. Replenish first.`,
        );
      }

      const qBefore = Number(balance.quantity);
      if (qBefore < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product "${product.name}": available ${qBefore}, requested ${dto.quantity}`,
        );
      }

      const qAfter = qBefore - dto.quantity;

      const updatedBalance = await tx.branchStockBalance.update({
        where: { id: balance.id },
        data: { quantity: qAfter },
      });

      const movement = await tx.stockMovement.create({
        data: {
          clinicId,
          branchId: dto.branchId,
          productId: dto.productId,
          idempotencyKey: dto.idempotencyKey,
          delta: -dto.quantity,
          quantityBefore: qBefore,
          quantityAfter: qAfter,
          reason: 'DISPENSE',
          referenceType: 'VISIT_RECORD',
          referenceId: dto.visitRecordId,
          actorId: dto.actorId,
        },
      });

      if (qAfter <= Number(product.reorderPoint)) {
        this.events.emit(
          'stock.low_stock_warning',
          new LowStockEvent(
            clinicId,
            dto.branchId,
            product.id,
            product.name,
            qAfter,
            Number(product.reorderPoint),
            product.sku ?? null,
            Number(product.minimumStock),
          ),
        );
      }

      return { balance: updatedBalance, movement };
    });
  }

  async getMovements(clinicId: string, branchId: string, productId?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.stockMovement.findMany({
      where: { branchId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: {
          select: { id: true, name: true },
        },
      },
    });
  }

  // ─── Goods Receipt (US1) ────────────────────────────────────────────────────

  async goodsReceipt(clinicId: string, branchId: string, actorId: string, dto: GoodsReceiptDto) {
    this.writeGuard.assertWritable();
    const db = scopedPrisma(this.prisma, clinicId);

    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    if (product.requiresBatchAndExpiryTracking) {
      if (!dto.lotNumber) {
        throw new BadRequestException(`Lot number is required for "${product.name}".`);
      }
      if (!dto.expiryDate) {
        throw new BadRequestException(`Expiry date is required for "${product.name}".`);
      }
    }

    const lotNumber = dto.lotNumber ?? null;
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    return this.prisma.$transaction(async (tx: any) => {
      // Upsert the balance row (lot-aware)
      const existing = await tx.branchStockBalance.findFirst({
        where: {
          clinicId,
          branchId,
          productId: dto.productId,
          lotNumber,
        },
      });

      let balance: { id: string; quantity: number; version: number };
      if (existing) {
        balance = await tx.branchStockBalance.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: dto.quantity },
            expiryDate: expiryDate ?? existing.expiryDate,
            version: { increment: 1 },
          },
        });
      } else {
        balance = await tx.branchStockBalance.create({
          data: {
            clinicId,
            branchId,
            productId: dto.productId,
            lotNumber,
            expiryDate,
            quantity: dto.quantity,
            version: 0,
          },
        });
      }

      const qAfter = Number(balance.quantity);

      const movement = await tx.stockMovement.create({
        data: {
          clinicId,
          branchId,
          productId: dto.productId,
          delta: dto.quantity,
          quantityBefore: qAfter - dto.quantity,
          quantityAfter: qAfter,
          reason: 'GOODS_RECEIPT',
          referenceType: 'REPLENISHMENT',
          referenceId: dto.referenceId ?? 'MANUAL',
          actorId,
          lotNumber,
          expiryDate,
          status: 'COMMITTED',
        },
      });

      const reorderPoint = Number(product.reorderPoint);
      if (qAfter > reorderPoint && reorderPoint > 0) {
        await this.alertService.resolveAlert(clinicId, branchId, dto.productId);
      } else if (reorderPoint > 0 && qAfter <= reorderPoint) {
        this.emitLowStock(product, clinicId, branchId, qAfter);
      }

      return { id: movement.id, status: 'COMMITTED', newBalance: qAfter };
    });
  }

  // ─── Get Issuable Lots (US2 — FEFO ordered) ─────────────────────────────────

  async getIssuableLots(clinicId: string, branchId: string, productId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const rows = await db.branchStockBalance.findMany({
      where: { clinicId, branchId, productId, quantity: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }, { lotNumber: 'asc' }],
    });

    const now = new Date();
    return rows.map((row: any, index: number) => ({
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      quantity: Number(row.quantity),
      isExpired: row.expiryDate ? row.expiryDate < now : false,
      isFefo: index === 0,
    }));
  }

  // ─── Goods Issue (US2) ───────────────────────────────────────────────────────

  async goodsIssue(clinicId: string, branchId: string, actorId: string, dto: GoodsIssueDto) {
    this.writeGuard.assertWritable();
    const db = scopedPrisma(this.prisma, clinicId);

    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    // Determine FEFO lot (first by expiryDate ASC, then lotNumber ASC)
    const lots = await this.getIssuableLots(clinicId, branchId, dto.productId);
    const fefoLot = lots[0] ?? null;

    const chosenLotNumber = dto.lotNumber ?? null;

    // Find the specific balance row to deduct from
    const balance = await db.branchStockBalance.findFirst({
      where: { clinicId, branchId, productId: dto.productId, lotNumber: chosenLotNumber },
    });
    if (!balance) {
      throw new BadRequestException(
        `No stock found for product "${product.name}"${chosenLotNumber ? ` lot "${chosenLotNumber}"` : ''} in this branch.`,
      );
    }

    // FEFO override check
    const isNonFefo = fefoLot && chosenLotNumber !== fefoLot.lotNumber;
    const isExpiredLot = balance.expiryDate ? balance.expiryDate < new Date() : false;

    if ((isNonFefo || isExpiredLot) && !dto.overrideReason) {
      throw new BadRequestException(
        isExpiredLot
          ? 'This lot has expired. An override reason is required.'
          : 'The selected lot is not the FEFO-recommended lot. An override reason is required.',
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      // Optimistic lock: update only if version matches
      const result = await tx.branchStockBalance.updateMany({
        where: { id: balance.id, version: balance.version },
        data: {
          quantity: { decrement: dto.quantity },
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Stock was modified concurrently; please retry.');
      }

      // Re-read to get the new quantity
      const updated = await tx.branchStockBalance.findUnique({ where: { id: balance.id } });
      const qAfter = Number(updated.quantity);

      if (qAfter < 0) {
        // Roll back by throwing — transaction will be aborted
        throw new ConflictException(`Insufficient stock for "${product.name}".`);
      }

      const movement = await tx.stockMovement.create({
        data: {
          clinicId,
          branchId,
          productId: dto.productId,
          delta: -dto.quantity,
          quantityBefore: qAfter + dto.quantity,
          quantityAfter: qAfter,
          reason: 'GOODS_ISSUE',
          referenceType: 'MANUAL',
          referenceId: dto.referenceId ?? 'MANUAL',
          actorId,
          lotNumber: chosenLotNumber,
          expiryDate: balance.expiryDate,
          overrideReason: dto.overrideReason ?? null,
          status: 'COMMITTED',
        },
      });

      const reorderPoint = Number(product.reorderPoint);
      if (reorderPoint > 0 && qAfter <= reorderPoint) {
        this.emitLowStock(product, clinicId, branchId, qAfter);
      }

      return { id: movement.id, status: 'COMMITTED', newBalance: qAfter };
    });
  }

  // ─── List stock balances (US1/US4) ──────────────────────────────────────────

  async listBalances(
    clinicId: string,
    opts: { branchId?: string; productId?: string; lowStock?: boolean; page: number; limit: number },
  ) {
    const db = scopedPrisma(this.prisma, clinicId);
    const where: any = { clinicId };
    if (opts.branchId) where.branchId = opts.branchId;
    if (opts.productId) where.productId = opts.productId;

    const [rows, total] = await Promise.all([
      db.branchStockBalance.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, reorderPoint: true } },
          branch: { select: { name: true } },
        },
        orderBy: [{ product: { name: 'asc' } }, { expiryDate: 'asc' }],
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      db.branchStockBalance.count({ where }),
    ]);

    const now = new Date();
    const data = rows
      .filter((r: any) => !opts.lowStock || Number(r.quantity) <= Number(r.product.reorderPoint))
      .map((r: any) => {
        const qty = Number(r.quantity);
        const rp = Number(r.product.reorderPoint);
        const expired = r.expiryDate ? r.expiryDate < now : false;
        const status =
          expired ? 'EXPIRED' : qty === 0 ? 'OUT_OF_STOCK' : qty <= rp ? 'LOW_STOCK' : 'IN_STOCK';
        return {
          id: r.id,
          branchId: r.branchId,
          branchName: (r.branch as any).name,
          productId: r.productId,
          productName: r.product.name,
          sku: r.product.sku,
          lotNumber: r.lotNumber,
          expiryDate: r.expiryDate,
          quantity: qty,
          reorderPoint: rp,
          status,
        };
      });

    return { data, total, page: opts.page, limit: opts.limit };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private emitLowStock(
    product: { id: string; name: string; sku: string | null; reorderPoint: any; minimumStock: any },
    clinicId: string,
    branchId: string,
    currentQty: number,
  ) {
    this.events.emit(
      'stock.low_stock_warning',
      new LowStockEvent(
        clinicId,
        branchId,
        product.id,
        product.name,
        currentQty,
        Number(product.reorderPoint),
        product.sku ?? null,
        Number(product.minimumStock),
      ),
    );
  }
}
