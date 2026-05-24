import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { StockService } from './stock.service';
import { InventoryWriteGuardService } from './inventory-write-guard.service';

// Make scopedPrisma a pass-through
jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown) => _prisma,
}));

const CLINIC_ID = 'clinic-001';
const BRANCH_ID = 'branch-001';

function buildBranchBalanceMock() {
  return {
    findUnique: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 10 }),
    upsert: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 0 }),
    update: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 15 }),
  };
}

function buildPrismaMock() {
  const branchStockBalance = buildBranchBalanceMock();
  return {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'sm-1' }),
    },
    branchStockBalance,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({ product: { findUnique: jest.fn() }, stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) }, branchStockBalance })),
  };
}

function buildEventsMock() {
  return { emit: jest.fn() };
}

describe('StockService', () => {
  let service: StockService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let events: ReturnType<typeof buildEventsMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    events = buildEventsMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        InventoryWriteGuardService,
        { provide: PrismaClient, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── replenish() ────────────────────────────────────────────────────────────

  describe('replenish()', () => {
    it('throws NotFoundException for unknown product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.replenish(CLINIC_ID, { branchId: BRANCH_ID, productId: 'bad', quantity: 5, referenceId: 'REF-001', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for SERVICE item', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Consultation', itemType: 'SERVICE', quantity: 0 });
      await expect(
        service.replenish(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 5, referenceId: 'REF-001', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('increases branch balance on replenishment', async () => {
      const product = { id: 'p1', name: 'Metronidazole', itemType: 'STOCKED_GOOD', quantity: 10, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);

      await service.replenish(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 5, referenceId: 'PO-001', actorId: 'user-1' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  // ─── deduct() ───────────────────────────────────────────────────────────────

  describe('deduct()', () => {
    it('throws NotFoundException for unknown product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.deduct(CLINIC_ID, { branchId: BRANCH_ID, productId: 'bad', quantity: 2, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for SERVICE item', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Consultation', itemType: 'SERVICE', quantity: 0 });
      await expect(
        service.deduct(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when insufficient stock', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 2 });
      prisma.branchStockBalance.findUnique.mockResolvedValue({ id: 'bal-1', quantity: 2 });
      prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn({ branchStockBalance: { findUnique: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 2 }) }, stockMovement: { create: jest.fn() } }));
      await expect(
        service.deduct(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 5, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deducts branch balance and creates movement record', async () => {
      const product = { id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 10, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);

      await service.deduct(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('emits LowStockEvent when balance falls at or below reorderThreshold', async () => {
      const product = { id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 6, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          branchStockBalance: {
            findUnique: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 6 }),
            update: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 5 }),
          },
          stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
        }),
      );

      await service.deduct(CLINIC_ID, { branchId: BRANCH_ID, productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' });

      expect(events.emit).toHaveBeenCalledWith(
        'inventory.low_stock',
        expect.objectContaining({ clinicId: CLINIC_ID, productId: 'p1', branchId: BRANCH_ID }),
      );
    });
  });

  // ─── branch-balance behaviour ─────────────────────────────────────────────

  describe('branch-balance writes', () => {
    it('writes replenishment into the active branch balance instead of Product.quantity', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Drug',
        itemType: 'STOCKED_GOOD',
        reorderThreshold: 5,
      });
      (prisma as any).branchStockBalance = {
        upsert: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 10 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 10 }),
        update: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 15 }),
      };
      prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
      prisma.stockMovement.create.mockResolvedValue({ id: 'sm-1' });

      await service.replenish(CLINIC_ID, {
        branchId: 'branch-1',
        productId: 'p1',
        quantity: 5,
        referenceId: 'PO-1',
        actorId: 'user-1',
      });

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect((prisma as any).branchStockBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: 'branch-1' }) }),
      );
    });

    it('rejects deduct when the branch has no balance row', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Drug',
        itemType: 'STOCKED_GOOD',
        reorderThreshold: 5,
      });
      (prisma as any).branchStockBalance = {
        findUnique: jest.fn().mockResolvedValue(null),
      };
      prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));

      await expect(
        service.deduct(CLINIC_ID, {
          branchId: 'branch-1',
          productId: 'p1',
          quantity: 1,
          visitRecordId: 'visit-1',
          actorId: 'user-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks stock writes while INVENTORY_WRITE_BLOCKED=true', async () => {
      process.env.INVENTORY_WRITE_BLOCKED = 'true';
      try {
        await expect(
          service.replenish(CLINIC_ID, {
            branchId: 'branch-1',
            productId: 'p1',
            quantity: 1,
            referenceId: 'PO-2',
            actorId: 'user-1',
          }),
        ).rejects.toThrow('Inventory writes are temporarily disabled during maintenance.');
      } finally {
        delete process.env.INVENTORY_WRITE_BLOCKED;
      }
    });
  });
});
