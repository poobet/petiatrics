import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, PurchaseOrderStatus, Role } from '@prisma/client';
import { PurchaseOrderService } from './purchase-order.service';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { NotFoundException } from '@nestjs/common';

// ── Helpers ──────────────────────────────────────────────────────────────────

let sequenceCounter = 0;

function buildSequenceServiceMock() {
  return {
    generate: jest.fn().mockImplementation(() => {
      sequenceCounter += 1;
      return Promise.resolve(`PO2026-07-${String(sequenceCounter).padStart(4, '0')}`);
    }),
  };
}

function buildPrismaMock() {
  const purchaseOrders: any[] = [];

  return {
    purchaseOrders,
    purchaseOrder: {
      create: jest.fn().mockImplementation(({ data, include }) => {
        const lines = (data.lines?.create || []).map((l: any, i: number) => ({
          id: `line-${i}`,
          purchaseOrderId: 'po-1',
          quantityReceived: 0,
          quantityInvoiced: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: { id: l.productId, name: `Product ${i}` },
          uom: l.uomId ? { id: l.uomId, name: 'Unit' } : null,
          ...l,
        }));

        const po = {
          id: 'po-1',
          clinicId: data.clinicId,
          supplierId: data.supplierId,
          code: data.code,
          referenceNumber: data.referenceNumber || null,
          status: data.status,
          orderDate: new Date(),
          creditTermDays: data.creditTermDays,
          notes: data.notes || null,
          subtotalMinor: data.subtotalMinor,
          discountTotalMinor: data.discountTotalMinor,
          taxTotalMinor: data.taxTotalMinor,
          totalMinor: data.totalMinor,
          createdById: data.createdById,
          approvedById: data.approvedById,
          approvedAt: data.approvedAt,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lines,
          supplier: { id: data.supplierId, name: 'Supplier' },
        };
        purchaseOrders.push(po);
        return Promise.resolve(po);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const po = purchaseOrders.find(
          (p) => p.id === where.id && p.clinicId === where.clinicId && p.deletedAt === null,
        );
        return Promise.resolve(po || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          purchaseOrders.filter(
            (p) =>
              p.clinicId === where.clinicId &&
              p.deletedAt === null &&
              (!where.status || p.status === where.status),
          ),
        );
      }),
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;
  let sequenceMock: ReturnType<typeof buildSequenceServiceMock>;

  beforeEach(async () => {
    sequenceCounter = 0;
    prismaMock = buildPrismaMock();
    sequenceMock = buildSequenceServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaClient, useValue: prismaMock as any },
        { provide: DocumentSequenceService, useValue: sequenceMock as any },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
  });

  // ── Financial Math ───────────────────────────────────────────────────────

  describe('Financial calculations', () => {
    it('should calculate line subtotal as (quantity × unitPrice) - discount', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [
          {
            productId: 'product-1',
            quantityOrdered: 10,
            unitPriceMinor: 1000,   // 10.00 per unit
            discountMinor: 500,      // 5.00 discount
          },
        ],
      });

      const line = po.lines[0];
      // lineGross = round(10 * 1000) = 10000
      // lineSubtotal = 10000 - 500 = 9500
      expect(line.subtotalMinor).toBe(9500);
      expect(line.discountMinor).toBe(500);
    });

    it('should calculate tax on the discounted subtotal, not the gross', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [
          {
            productId: 'product-1',
            quantityOrdered: 1,
            unitPriceMinor: 10000,  // 100.00
            discountMinor: 2000,     // 20.00 discount
            taxRateBps: 700,         // 7% tax
          },
        ],
      });

      const line = po.lines[0];
      // lineGross = 10000, lineSubtotal = 10000 - 2000 = 8000
      // lineTax = round(8000 * 700/10000) = round(560) = 560
      expect(line.subtotalMinor).toBe(8000);
      expect(line.taxTotalMinor).toBe(560);
      expect(line.totalMinor).toBe(8560);
    });

    it('should aggregate header discount + line discounts into discountTotalMinor', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        discountTotalMinor: 300, // header-level discount
        lines: [
          {
            productId: 'product-1',
            quantityOrdered: 5,
            unitPriceMinor: 2000,
            discountMinor: 200, // line discount
          },
          {
            productId: 'product-2',
            quantityOrdered: 3,
            unitPriceMinor: 1000,
            discountMinor: 100, // line discount
          },
        ],
      });

      // lineDiscounts = 200 + 100 = 300
      // totalDiscount = 300 (header) + 300 (lines) = 600
      expect(po.discountTotalMinor).toBe(600);
    });

    it('should calculate totalMinor as subtotal + tax - headerDiscount', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        discountTotalMinor: 500, // header discount
        lines: [
          {
            productId: 'product-1',
            quantityOrdered: 10,
            unitPriceMinor: 1000,
            taxRateBps: 700, // 7%
          },
        ],
      });

      // lineGross = 10000, lineDiscount = 0, lineSubtotal = 10000
      // lineTax = round(10000 * 0.07) = 700
      // subtotal = 10000, taxTotal = 700
      // finalTotal = 10000 + 700 - 500 = 10200
      expect(po.subtotalMinor).toBe(10000);
      expect(po.taxTotalMinor).toBe(700);
      expect(po.totalMinor).toBe(10200);
    });

    it('should handle zero discounts gracefully', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [
          {
            productId: 'product-1',
            quantityOrdered: 2,
            unitPriceMinor: 5000,
          },
        ],
      });

      expect(po.subtotalMinor).toBe(10000);
      expect(po.discountTotalMinor).toBe(0);
      expect(po.taxTotalMinor).toBe(0);
      expect(po.totalMinor).toBe(10000);
    });

    it('should persist referenceNumber when provided', async () => {
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        referenceNumber: 'QUO-2026-001',
        lines: [
          { productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 100 },
        ],
      });

      expect(po.referenceNumber).toBe('QUO-2026-001');
    });
  });

  // ── Auto-Approve Roles ──────────────────────────────────────────────────

  describe('Auto-approve by role', () => {
    const baseDtoSingleLine = {
      supplierId: 'supplier-1',
      lines: [{ productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 100 }],
    };

    it.each([Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET])(
      'should auto-approve for role %s',
      async (role) => {
        const po = await service.create('clinic-1', 'user-1', role, 'branch-1', baseDtoSingleLine);
        expect(po.status).toBe(PurchaseOrderStatus.APPROVED);
        expect(po.approvedById).toBe('user-1');
        expect(po.approvedAt).toBeInstanceOf(Date);
      },
    );

    it.each([Role.ASSISTANT, Role.CASHIER, Role.STAFF])(
      'should create as DRAFT for role %s',
      async (role) => {
        const po = await service.create('clinic-1', 'user-1', role, 'branch-1', baseDtoSingleLine);
        expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
        expect(po.approvedById).toBeNull();
        expect(po.approvedAt).toBeNull();
      },
    );
  });

  // ── Concurrency ─────────────────────────────────────────────────────────

  describe('Concurrency', () => {
    it('should generate 50 unique PO codes for concurrent creates', async () => {
      const dto = {
        supplierId: 'supplier-1',
        lines: [{ productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 100 }],
      };

      const promises = Array.from({ length: 50 }).map(() =>
        service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', dto),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);

      const codes = results.map((po) => po.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(50);

      // Verify sequence service was called 50 times
      expect(sequenceMock.generate).toHaveBeenCalledTimes(50);
    });
  });

  // ── Soft Delete Filtering ──────────────────────────────────────────────

  describe('Soft delete filtering', () => {
    it('findOne should not return soft-deleted POs', async () => {
      // Create a PO, then mark it as deleted
      const po = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [{ productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 100 }],
      });
      po.deletedAt = new Date(); // simulate soft delete

      await expect(service.findOne('clinic-1', po.id)).rejects.toThrow(NotFoundException);
    });

    it('findAll should exclude soft-deleted POs', async () => {
      // Create two POs
      await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [{ productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 100 }],
      });
      const po2 = await service.create('clinic-1', 'user-1', Role.CLINIC_OWNER, 'branch-1', {
        supplierId: 'supplier-1',
        lines: [{ productId: 'product-1', quantityOrdered: 1, unitPriceMinor: 200 }],
      });
      po2.deletedAt = new Date(); // simulate soft delete on second PO

      const results = await service.findAll('clinic-1');
      // Only the non-deleted PO should appear
      expect(results.length).toBe(1);
    });
  });
});
