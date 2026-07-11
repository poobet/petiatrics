import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PurchaseOrderStatus, Role, DocumentType } from '@prisma/client';
import { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto';
import { DocumentSequenceService } from '../../document-sequence/services/document-sequence.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
  ) {}

  async create(clinicId: string, userId: string, userRole: Role, dto: CreatePurchaseOrderDto) {
    // Generate sequential PO code
    const code = await this.sequenceService.generate(clinicId, DocumentType.PURCHASE_ORDER);

    let subtotal = 0;
    let taxTotal = 0;

    const linesToCreate = dto.lines.map(line => {
      const lineSubtotal = Math.round(Number(line.quantityOrdered) * line.unitPriceMinor);
      const lineTax = Math.round(lineSubtotal * ((line.taxRateBps || 0) / 10000));
      subtotal += lineSubtotal;
      taxTotal += lineTax;

      return {
        productId: line.productId,
        uomId: line.uomId,
        quantityOrdered: line.quantityOrdered,
        unitPriceMinor: line.unitPriceMinor,
        subtotalMinor: lineSubtotal,
        taxRateBps: line.taxRateBps || 0,
        taxTotalMinor: lineTax,
        totalMinor: lineSubtotal + lineTax,
      };
    });

    // Auto-approve if Manager, Owner, or Vet
    const canAutoApprove = ([Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET] as Role[]).includes(userRole);
    const status = canAutoApprove ? PurchaseOrderStatus.APPROVED : PurchaseOrderStatus.DRAFT;

    return this.prisma.purchaseOrder.create({
      data: {
        clinicId,
        supplierId: dto.supplierId,
        code,
        status,
        creditTermDays: dto.creditTermDays || 0,
        notes: dto.notes,
        subtotalMinor: subtotal,
        taxTotalMinor: taxTotal,
        totalMinor: subtotal + taxTotal,
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
      where: { id, clinicId },
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
      where: { id, clinicId },
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
      where: { id, clinicId },
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
      where: { id, clinicId },
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
