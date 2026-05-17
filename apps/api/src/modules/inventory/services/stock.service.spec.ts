import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { StockService } from './stock.service';

// Make scopedPrisma a pass-through
jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown) => _prisma,
}));

const CLINIC_ID = 'clinic-001';

function buildPrismaMock() {
  return {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
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
        service.replenish(CLINIC_ID, { productId: 'bad', quantity: 5, referenceId: 'REF-001', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for SERVICE item', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Consultation', itemType: 'SERVICE', quantity: 0 });
      await expect(
        service.replenish(CLINIC_ID, { productId: 'p1', quantity: 5, referenceId: 'REF-001', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('increases product quantity on replenishment', async () => {
      const product = { id: 'p1', name: 'Metronidazole', itemType: 'STOCKED_GOOD', quantity: 10, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue({ ...product, quantity: 15 });
      prisma.stockMovement.create.mockResolvedValue({ id: 'sm-1' });

      await service.replenish(CLINIC_ID, { productId: 'p1', quantity: 5, referenceId: 'PO-001', actorId: 'user-1' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) }),
      );
    });
  });

  // ─── deduct() ───────────────────────────────────────────────────────────────

  describe('deduct()', () => {
    it('throws NotFoundException for unknown product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.deduct(CLINIC_ID, { productId: 'bad', quantity: 2, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for SERVICE item', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Consultation', itemType: 'SERVICE', quantity: 0 });
      await expect(
        service.deduct(CLINIC_ID, { productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when insufficient stock', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 2 });
      await expect(
        service.deduct(CLINIC_ID, { productId: 'p1', quantity: 5, visitRecordId: 'v1', actorId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deducts stock and creates movement record', async () => {
      const product = { id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 10, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue({ ...product, quantity: 9 });
      prisma.stockMovement.create.mockResolvedValue({ id: 'sm-1' });

      await service.deduct(CLINIC_ID, { productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 9 }) }),
      );
    });

    it('emits LowStockEvent when quantity falls at or below reorderThreshold', async () => {
      const product = { id: 'p1', name: 'Drug', itemType: 'STOCKED_GOOD', quantity: 6, reorderThreshold: 5 };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue({ ...product, quantity: 5 });
      prisma.stockMovement.create.mockResolvedValue({ id: 'sm-1' });

      await service.deduct(CLINIC_ID, { productId: 'p1', quantity: 1, visitRecordId: 'v1', actorId: 'user-1' });

      expect(events.emit).toHaveBeenCalledWith(
        'inventory.low_stock',
        expect.objectContaining({ clinicId: CLINIC_ID, productId: 'p1' }),
      );
    });
  });
});
