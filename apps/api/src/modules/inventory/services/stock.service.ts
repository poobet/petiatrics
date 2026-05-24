import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { LowStockEvent } from '../../../common/events/domain-events';
import { InventoryWriteGuardService } from './inventory-write-guard.service';

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
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
    private readonly writeGuard: InventoryWriteGuardService,
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
    });
  }
}
