import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient, GoodsReceiptStatus, PurchaseOrderStatus, StockMovementReason, StockMovementRefType, StockMovementStatus } from '@prisma/client';
import { CreateGoodsReceiptDto } from '../dtos/create-goods-receipt.dto';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { GoodsReceiptCompletedEvent } from '../../../common/events/domain-events';

@Injectable()
export class GoodsReceiptService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
    private readonly events: EventEmitter2,
  ) {}

  async createAndCommit(clinicId: string, userId: string, branchId: string, dto: CreateGoodsReceiptDto) {
    const code = await this.sequenceService.generate(clinicId, DOC_TYPE.GOODS_RECEIPT, new Date(), branchId);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Validation loop
      for (const line of dto.lines) {
        const product = await tx.product.findFirst({
          where: { id: line.productId, clinicId },
        });
        if (!product) {
          throw new NotFoundException(`Product with ID ${line.productId} not found`);
        }

        // Medical compliance: Batch & Expiry tracking check
        if (product.requiresBatchAndExpiryTracking) {
          if (!line.lotNumber || !line.expiryDate) {
            throw new BadRequestException(
              `Product "${product.name}" requires a batch Lot Number and Expiry Date for compliance.`
            );
          }
          if (new Date(line.expiryDate) <= new Date()) {
            throw new BadRequestException(
              `Expiry Date for product "${product.name}" must be in the future.`
            );
          }
        }

        // Over-receiving validation
        if (line.poLineId) {
          const poLine = await tx.purchaseOrderLine.findUnique({
            where: { id: line.poLineId },
          });
          if (!poLine) {
            throw new NotFoundException(`Purchase Order Line ${line.poLineId} not found`);
          }
          const remaining = Number(poLine.quantityOrdered) - Number(poLine.quantityReceived);
          if (Number(line.quantityReceived) > remaining) {
            if (!dto.overrideReason) {
              throw new BadRequestException(
                `Receiving ${line.quantityReceived} exceeds outstanding ordered quantity of ${remaining} for product "${product.name}". An override reason is required.`
              );
            }
          }
        }
      }

      // 2. Create Goods Receipt in COMMITTED status
      const gr = await tx.goodsReceipt.create({
        data: {
          clinicId,
          purchaseOrderId: dto.purchaseOrderId || null,
          code,
          status: GoodsReceiptStatus.COMMITTED,
          receivedById: userId,
          overrideReason: dto.overrideReason || null,
          lines: {
            create: dto.lines.map(line => ({
              poLineId: line.poLineId || null,
              branchId: line.branchId,
              productId: line.productId,
              uomId: line.uomId || null,
              quantityReceived: line.quantityReceived,
              lotNumber: line.lotNumber || null,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              product: true,
              branch: true,
            },
          },
        },
      });

      // 3. Process inventory and update balances/PO quantities
      for (const line of gr.lines) {
        let finalQty = Number(line.quantityReceived);

        // UoM conversion check
        if (line.uomId) {
          const conversion = await tx.itemUnitConversion.findFirst({
            where: { productId: line.productId, unitId: line.uomId },
          });
          if (conversion) {
            finalQty = Number(line.quantityReceived) * Number(conversion.ratioToBase);
          }
        }

        // Update branch stock balance (match exact clinic, branch, product, and lot)
        const balance = await tx.branchStockBalance.findFirst({
          where: {
            clinicId,
            branchId: line.branchId,
            productId: line.productId,
            lotNumber: line.lotNumber,
          },
        });

        const quantityBefore = balance ? Number(balance.quantity) : 0;
        const quantityAfter = quantityBefore + finalQty;

        if (balance) {
          await tx.branchStockBalance.update({
            where: { id: balance.id },
            data: {
              quantity: quantityAfter,
              version: { increment: 1 },
            },
          });
        } else {
          await tx.branchStockBalance.create({
            data: {
              clinicId,
              branchId: line.branchId,
              productId: line.productId,
              lotNumber: line.lotNumber || null,
              expiryDate: line.expiryDate,
              quantity: finalQty,
            },
          });
        }

        // Create immutable Stock Movement ledger entry
        await tx.stockMovement.create({
          data: {
            clinicId,
            branchId: line.branchId,
            productId: line.productId,
            delta: finalQty,
            quantityBefore,
            quantityAfter,
            reason: StockMovementReason.GOODS_RECEIPT,
            referenceType: StockMovementRefType.REPLENISHMENT,
            referenceId: gr.id,
            actorId: userId,
            lotNumber: line.lotNumber || null,
            expiryDate: line.expiryDate,
            status: StockMovementStatus.COMMITTED,
          },
        });

        // Increment quantity received on PO line
        if (line.poLineId) {
          await tx.purchaseOrderLine.update({
            where: { id: line.poLineId },
            data: {
              quantityReceived: { increment: line.quantityReceived },
            },
          });
        }
      }

      // 4. Update parent PO status if linked
      if (dto.purchaseOrderId) {
        const poLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: dto.purchaseOrderId },
        });

        const allReceived = poLines.every(
          (pl) => Number(pl.quantityReceived) >= Number(pl.quantityOrdered)
        );
        const someReceived = poLines.some((pl) => Number(pl.quantityReceived) > 0);

        await tx.purchaseOrder.update({
          where: { id: dto.purchaseOrderId },
          data: {
            status: allReceived
              ? PurchaseOrderStatus.FULLY_RECEIVED
              : someReceived
              ? PurchaseOrderStatus.PARTIALLY_RECEIVED
              : PurchaseOrderStatus.APPROVED,
          },
        });
      }

      return gr;
    });

    // Emit events after transaction commits for GL integration (one per line)
    for (const line of result.lines) {
      const product = line.product as any;
      const unitCostMinor = Math.round(Number(product?.standardCost ?? 0) * 100);
      this.events.emit(
        'inventory.goods_receipt_completed',
        new GoodsReceiptCompletedEvent(
          clinicId,
          line.branchId,
          line.productId,
          Number(line.quantityReceived),
          unitCostMinor,
          null,
          result.id,
          'REPLENISHMENT',
        ),
      );
    }

    return result;
  }

  async findOne(clinicId: string, id: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({
      where: { id, clinicId },
      include: {
        lines: {
          include: {
            product: true,
            branch: true,
            uom: true,
          },
        },
        purchaseOrder: true,
        receivedBy: {
          select: { name: true, email: true },
        },
      },
    });
    if (!gr) throw new NotFoundException(`Goods Receipt with ID ${id} not found`);
    return gr;
  }

  async findAll(clinicId: string) {
    return this.prisma.goodsReceipt.findMany({
      where: { clinicId },
      include: {
        purchaseOrder: {
          select: { code: true },
        },
        receivedBy: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
