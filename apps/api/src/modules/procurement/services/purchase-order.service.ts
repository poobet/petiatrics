import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PurchaseOrderStatus, Role } from '@prisma/client';
import { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
  ) {}

  async create(clinicId: string, userId: string, userRole: Role, branchId: string, dto: CreatePurchaseOrderDto) {
    // Generate sequential PO code
    const code = await this.sequenceService.generate(clinicId, DOC_TYPE.PURCHASE_ORDER, new Date(), branchId);

    let subtotal = 0;
    let taxTotal = 0;
    let lineDiscounts = 0;

    const linesToCreate = dto.lines.map(line => {
      const lineGross = Math.round(Number(line.quantityOrdered) * line.unitPriceMinor);
      const lineDiscount = line.discountMinor || 0;
      const lineSubtotal = lineGross - lineDiscount;
      const lineTax = Math.round(lineSubtotal * ((line.taxRateBps || 0) / 10000));

      subtotal += lineSubtotal;
      taxTotal += lineTax;
      lineDiscounts += lineDiscount;

      return {
        productId: line.productId,
        uomId: line.uomId,
        quantityOrdered: line.quantityOrdered,
        unitPriceMinor: line.unitPriceMinor,
        discountMinor: lineDiscount,
        subtotalMinor: lineSubtotal,
        taxRateBps: line.taxRateBps || 0,
        taxTotalMinor: lineTax,
        totalMinor: lineSubtotal + lineTax,
      };
    });

    const headerDiscount = dto.discountTotalMinor || 0;
    const totalDiscount = headerDiscount + lineDiscounts;
    const finalTotal = subtotal + taxTotal - headerDiscount;

    // Auto-approve if Manager, Owner, or Vet
    const canAutoApprove = ([Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET] as Role[]).includes(userRole);
    const status = canAutoApprove ? PurchaseOrderStatus.APPROVED : PurchaseOrderStatus.DRAFT;

    return this.prisma.purchaseOrder.create({
      data: {
        clinicId,
        supplierId: dto.supplierId,
        code,
        referenceNumber: dto.referenceNumber,
        status,
        creditTermDays: dto.creditTermDays || 0,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        notes: dto.notes,
        subtotalMinor: subtotal,
        discountTotalMinor: totalDiscount,
        taxTotalMinor: taxTotal,
        totalMinor: finalTotal,
        createdById: userId,
        approvedById: canAutoApprove ? userId : null,
        approvedAt: canAutoApprove ? new Date() : null,
        lines: {
          create: linesToCreate,
        },
      },
      include: {
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
        supplier: true,
      },
    });
  }

  async findOne(clinicId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
        supplier: true,
      },
    });
    if (!po) throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    return po;
  }

  async findAll(clinicId: string, status?: PurchaseOrderStatus) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        clinicId,
        deletedAt: null,
        status: status || undefined,
      },
      include: {
        supplier: true,
        createdBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitForApproval(clinicId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!po) throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new ForbiddenException(`Only DRAFT Purchase Orders can be submitted for approval`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.PENDING_APPROVAL,
      },
    });
  }

  async approve(clinicId: string, userId: string, userRole: Role, id: string) {
    if (!([Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET] as Role[]).includes(userRole)) {
      throw new ForbiddenException('Only managers, owners or vets can approve POs');
    }

    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!po) throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL && po.status !== PurchaseOrderStatus.DRAFT) {
      throw new ForbiddenException(`Only DRAFT or PENDING_APPROVAL Purchase Orders can be approved`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async cancel(clinicId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!po) throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    if (([PurchaseOrderStatus.CLOSED, PurchaseOrderStatus.FULLY_RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] as PurchaseOrderStatus[]).includes(po.status)) {
      throw new ForbiddenException('Cannot cancel a Purchase Order that has been received or closed');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
      },
    });
  }
}
