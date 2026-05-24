import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from '../services/stock.service';
import { Role } from '@petiatrics/types';

function getRolesMetadata(handler: object): Role[] {
  return Reflect.getMetadata('roles', handler) ?? [];
}

const CLINIC_ID = 'clinic-001';
const BRANCH_ID = 'branch-001';

function buildServiceMock() {
  return {
    replenish: jest.fn().mockResolvedValue({ balance: { quantity: 15 }, movement: { id: 'sm-1' } }),
    deduct: jest.fn().mockResolvedValue({ balance: { quantity: 9 }, movement: { id: 'sm-2' } }),
    getMovements: jest.fn().mockResolvedValue([]),
  };
}

const user = { userId: 'user-1', clinicId: CLINIC_ID, role: Role.CLINIC_OWNER };

describe('StockController', () => {
  let controller: StockController;
  let service: ReturnType<typeof buildServiceMock>;

  beforeEach(async () => {
    service = buildServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [{ provide: StockService, useValue: service }],
    }).compile();

    controller = module.get<StockController>(StockController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── replenish() ─────────────────────────────────────────────────────────

  describe('replenish()', () => {
    it('passes branchId through to StockService', async () => {
      await controller.replenish(CLINIC_ID, BRANCH_ID, user as any, {
        productId: 'p1',
        quantity: 5,
        referenceId: 'PO-1',
      });

      expect(service.replenish).toHaveBeenCalledWith(CLINIC_ID, {
        branchId: BRANCH_ID,
        productId: 'p1',
        quantity: 5,
        referenceId: 'PO-1',
        actorId: user.userId,
      });
    });

    it('requires CLINIC_OWNER role', () => {
      const roles = getRolesMetadata(StockController.prototype.replenish);
      expect(roles).toContain(Role.CLINIC_OWNER);
      expect(roles).not.toContain(Role.VET);
    });
  });

  // ─── getMovements() ──────────────────────────────────────────────────────

  describe('getMovements()', () => {
    it('passes active branch and optional productId to service', async () => {
      await controller.getMovements(CLINIC_ID, BRANCH_ID, 'p1');
      expect(service.getMovements).toHaveBeenCalledWith(CLINIC_ID, BRANCH_ID, 'p1');
    });

    it('passes undefined productId when not provided', async () => {
      await controller.getMovements(CLINIC_ID, BRANCH_ID);
      expect(service.getMovements).toHaveBeenCalledWith(CLINIC_ID, BRANCH_ID, undefined);
    });
  });
});
