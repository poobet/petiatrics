import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { LowStockEvent } from '../../../common/events/domain-events';

export interface ReplenishDto {
  productId: string;
  quantity: number;
  referenceId: string; // supplier order ID or manual reference
  actorId: string;
}

export interface DeductDto {
  productId: string;
  quantity: number;
  visitRecordId: string;
  actorId: string;
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  async replenish(clinicId: string, dto: ReplenishDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    const qBefore = Number(product.quantity);
    const qAfter = qBefore + dto.quantity;

    const [updatedProduct, movement] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { quantity: qAfter },
      }),
      this.prisma.stockMovement.create({
        data: {
          clinicId,
          productId: dto.productId,
          delta: dto.quantity,
          quantityBefore: qBefore,
          quantityAfter: qAfter,
          reason: 'REPLENISH',
          referenceType: 'REPLENISHMENT',
          referenceId: dto.referenceId,
          actorId: dto.actorId,
        },
      }),
    ]);

    return { product: updatedProduct, movement };
  }

  async deduct(clinicId: string, dto: DeductDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
    if (product.itemType === 'SERVICE') {
      throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
    }

    const qBefore = Number(product.quantity);
    if (qBefore < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}: available ${qBefore}, requested ${dto.quantity}`,
      );
    }

    const qAfter = qBefore - dto.quantity;

    const [updatedProduct, movement] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { quantity: qAfter },
      }),
      this.prisma.stockMovement.create({
        data: {
          clinicId,
          productId: dto.productId,
          delta: -dto.quantity,
          quantityBefore: qBefore,
          quantityAfter: qAfter,
          reason: 'DISPENSE',
          referenceType: 'VISIT_RECORD',
          referenceId: dto.visitRecordId,
          actorId: dto.actorId,
        },
      }),
    ]);

    // Fire low-stock alert if quantity now at or below threshold
    if (qAfter <= Number(product.reorderThreshold)) {
      this.events.emit(
        'inventory.low_stock',
        new LowStockEvent(
          clinicId,
          product.id,
          product.name,
          qAfter,
          Number(product.reorderThreshold),
        ),
      );
    }

    return { product: updatedProduct, movement };
  }

  async getMovements(clinicId: string, productId?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.stockMovement.findMany({
      where: productId ? { productId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
