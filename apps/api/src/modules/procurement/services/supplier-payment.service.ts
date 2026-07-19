import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PurchaseInvoiceStatus } from '@prisma/client';
import { CreateSupplierPaymentDto } from '../dtos/create-supplier-payment.dto';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';

/** e-WHT reduced rate for electronic transactions (Thai gov incentive through Dec 31, 2027) */
const E_WHT_RATE_BPS = 100; // 1%
/** Standard WHT rate for services */
const STANDARD_WHT_RATE_BPS = 300; // 3%

@Injectable()
export class SupplierPaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
  ) {}

  async create(clinicId: string, userId: string, branchId: string, dto: CreateSupplierPaymentDto) {
    const code = await this.sequenceService.generate(clinicId, DOC_TYPE.SUPPLIER_PAYMENT, new Date(), branchId);

    return this.prisma.$transaction(async (tx) => {
      // Validate all allocations before creating payment
      let totalAllocated = 0;
      for (const alloc of dto.allocations) {
        const invoice = await tx.purchaseInvoice.findFirst({
          where: { id: alloc.purchaseInvoiceId, clinicId },
        });
        if (!invoice) {
          throw new NotFoundException(`Purchase Invoice ${alloc.purchaseInvoiceId} not found`);
        }
        if (invoice.status === PurchaseInvoiceStatus.VOIDED) {
          throw new BadRequestException(`Cannot allocate payment to voided invoice ${invoice.code}`);
        }

        const outstanding = invoice.totalMinor - invoice.amountPaidMinor;
        if (alloc.amountAllocatedMinor > outstanding) {
          throw new BadRequestException(
            `Allocation of ${alloc.amountAllocatedMinor} exceeds outstanding amount of ${outstanding} on invoice ${invoice.code}`
          );
        }
        totalAllocated += alloc.amountAllocatedMinor;
      }

      if (totalAllocated > dto.amountMinor) {
        throw new BadRequestException(
          `Total allocations (${totalAllocated}) exceed payment amount (${dto.amountMinor})`
        );
      }

      // Determine WHT: use provided values or auto-calculate
      const whtRateBps = dto.whtRateBps ?? (dto.paymentMethod === 'BANK_TRANSFER' ? E_WHT_RATE_BPS : 0);
      const whtAmountMinor = dto.whtAmountMinor ?? Math.round(dto.amountMinor * whtRateBps / 10000);

      // Create payment record
      const payment = await tx.supplierPayment.create({
        data: {
          clinicId,
          supplierId: dto.supplierId,
          code,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber || null,
          amountMinor: dto.amountMinor,
          whtAmountMinor,
          whtRateBps,
          createdById: userId,
          allocations: {
            create: dto.allocations.map(alloc => ({
              purchaseInvoiceId: alloc.purchaseInvoiceId,
              amountAllocatedMinor: alloc.amountAllocatedMinor,
            })),
          },
        },
        include: {
          allocations: {
            include: {
              invoice: { select: { code: true, totalMinor: true, amountPaidMinor: true } },
            },
          },
          supplier: { select: { name: true } },
        },
      });

      // Update amountPaidMinor and status on each allocated invoice
      for (const alloc of dto.allocations) {
        const updatedInvoice = await tx.purchaseInvoice.update({
          where: { id: alloc.purchaseInvoiceId },
          data: {
            amountPaidMinor: { increment: alloc.amountAllocatedMinor },
          },
        });

        // Determine new invoice status
        const newAmountPaid = updatedInvoice.amountPaidMinor;
        let newStatus: PurchaseInvoiceStatus;
        if (newAmountPaid >= updatedInvoice.totalMinor) {
          newStatus = PurchaseInvoiceStatus.PAID;
        } else if (newAmountPaid > 0) {
          newStatus = PurchaseInvoiceStatus.PARTIALLY_PAID;
        } else {
          newStatus = updatedInvoice.status;
        }

        if (newStatus !== updatedInvoice.status) {
          await tx.purchaseInvoice.update({
            where: { id: alloc.purchaseInvoiceId },
            data: { status: newStatus },
          });
        }
      }

      return payment;
    });
  }

  async findOne(clinicId: string, id: string) {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, clinicId },
      include: {
        allocations: {
          include: {
            invoice: {
              select: { code: true, invoiceNumber: true, totalMinor: true, amountPaidMinor: true, status: true },
            },
          },
        },
        supplier: { select: { name: true, taxId: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!payment) throw new NotFoundException(`Supplier Payment ${id} not found`);
    return payment;
  }

  async findAll(clinicId: string) {
    return this.prisma.supplierPayment.findMany({
      where: { clinicId },
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        allocations: {
          select: { amountAllocatedMinor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
