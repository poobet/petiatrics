import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StockAdjustmentService } from './stock-adjustment.service';

describe('StockAdjustmentService', () => {
  let service: StockAdjustmentService;
  let prismaMock: any;
  let eventEmitterMock: any;

  beforeEach(async () => {
    prismaMock = {
      reasonCode: {
        findFirst: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
      },
      stockAdjustment: {
        create: jest.fn(),
      },
      branchStockBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAdjustmentService,
        { provide: PrismaClient, useValue: prismaMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<StockAdjustmentService>(StockAdjustmentService);
  });

  describe('createAdjustment', () => {
    it('should throw BadRequestException if reason code does not exist or is inactive', async () => {
      prismaMock.reasonCode.findFirst.mockResolvedValue(null);

      await expect(
        service.createAdjustment('clinic-1', 'branch-1', 'user-1', {
          productId: 'prod-1',
          quantity: -5,
          reasonCodeId: 'invalid-reason',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if product is not found', async () => {
      prismaMock.reasonCode.findFirst.mockResolvedValue({
        id: 'reason-1',
        code: 'EXPIRED',
        type: 'EXPIRED',
        requiresVatCalculation: false,
      });
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(
        service.createAdjustment('clinic-1', 'branch-1', 'user-1', {
          productId: 'non-existent-product',
          quantity: -2,
          reasonCodeId: 'reason-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully record adjustment and emit StockAdjustedEvent with requiresVatCalculation flag', async () => {
      const mockReasonCode = {
        id: 'reason-vat-1',
        code: 'MISSING_UNKNOWN',
        type: 'SHRINKAGE',
        requiresVatCalculation: true,
      };

      const mockProduct = {
        id: 'prod-1',
        standardCost: 150.0,
        branchSettings: [
          { movingAverageCost: 150.0 },
        ],
      };

      const mockCreatedAdjustment = {
        id: 'adj-100',
        clinicId: 'clinic-1',
        branchId: 'branch-1',
        productId: 'prod-1',
        quantity: -10,
        unitCostMinor: 15000,
        totalCostMinor: 150000,
        reasonCodeId: 'reason-vat-1',
        adjustedBy: 'user-1',
        status: 'COMMITTED',
      };

      prismaMock.reasonCode.findFirst.mockResolvedValue(mockReasonCode);
      prismaMock.product.findFirst.mockResolvedValue(mockProduct);
      prismaMock.stockAdjustment.create.mockResolvedValue(mockCreatedAdjustment);

      const result = await service.createAdjustment('clinic-1', 'branch-1', 'user-1', {
        productId: 'prod-1',
        quantity: -10,
        reasonCodeId: 'reason-vat-1',
        notes: 'Inventory count shortage',
      });

      expect(result).toEqual(mockCreatedAdjustment);
      expect(prismaMock.branchStockBalance.create).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'inventory.stock_adjusted',
        expect.objectContaining({
          clinicId: 'clinic-1',
          branchId: 'branch-1',
          adjustmentId: 'adj-100',
          productId: 'prod-1',
          quantity: -10,
          unitCostMinor: 15000,
          totalCostMinor: 150000,
          reasonCode: 'MISSING_UNKNOWN',
          requiresVatCalculation: true,
        }),
      );
    });
  });
});
