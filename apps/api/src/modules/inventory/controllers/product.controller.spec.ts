import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from '../services/product.service';
import { Role, ItemType } from '@petiatrics/types';

// ─── Decorator metadata helpers ───────────────────────────────────────────────

// NestJS SetMetadata stores on the handler function, not prototype+key
function getRolesMetadata(handler: object): Role[] {
  return Reflect.getMetadata('roles', handler) ?? [];
}

function getAuditMetadata(handler: object) {
  return Reflect.getMetadata('audit', handler);
}

// ─── Mock service ─────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-001';

function buildServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, perPage: 50 }),
    findById: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    deactivate: jest.fn().mockResolvedValue({ id: 'p1', isActive: false }),
    getLowStock: jest.fn().mockResolvedValue([]),
  };
}

describe('ProductController', () => {
  let controller: ProductController;
  let service: ReturnType<typeof buildServiceMock>;

  beforeEach(async () => {
    service = buildServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: service }],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Role matrix ─────────────────────────────────────────────────────────

  describe('role matrix', () => {
    const proto = ProductController.prototype;

    it('POST / requires CLINIC_OWNER only', () => {
      const roles = getRolesMetadata(proto.create);
      expect(roles).toContain(Role.CLINIC_OWNER);
      expect(roles).not.toContain(Role.VET);
      expect(roles).not.toContain(Role.CASHIER);
    });

    it('GET / is accessible to all clinic roles', () => {
      const roles = getRolesMetadata(proto.findAll);
      expect(roles).toContain(Role.CLINIC_OWNER);
      expect(roles).toContain(Role.VET);
      expect(roles).toContain(Role.ASSISTANT);
      expect(roles).toContain(Role.CASHIER);
      expect(roles).toContain(Role.STAFF);
    });

    it('PATCH /:id requires CLINIC_OWNER only', () => {
      const roles = getRolesMetadata(proto.update);
      expect(roles).toContain(Role.CLINIC_OWNER);
      expect(roles).not.toContain(Role.VET);
    });

    it('PATCH /:id/deactivate requires CLINIC_OWNER only', () => {
      const roles = getRolesMetadata(proto.deactivate);
      expect(roles).toContain(Role.CLINIC_OWNER);
      expect(roles).not.toContain(Role.STAFF);
    });
  });

  // ─── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('delegates to service.create with clinicId and dto', async () => {
      const dto = { code: 'MED-001', name: 'Test', itemType: ItemType.STOCKED_GOOD, categoryId: 'c1', baseUnitId: 'u1', standardCost: 100, baseSellingPrice: 180 };
      await controller.create(CLINIC_ID, dto as any);
      expect(service.create).toHaveBeenCalledWith(CLINIC_ID, dto);
    });

    it('has @Audit create metadata', () => {
      const audit = getAuditMetadata(ProductController.prototype.create);
      expect(audit).toMatchObject({ entity: 'Product', operation: 'create' });
    });
  });

  // ─── findAll() ───────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('passes active branch to service', async () => {
      const result = await controller.findAll(CLINIC_ID, 'branch-1', {});
      expect(service.findAll).toHaveBeenCalledWith(CLINIC_ID, 'branch-1', {});
      expect(result).toMatchObject({ items: [], total: 0 });
    });
  });

  // ─── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('delegates to service.findById', async () => {
      await controller.findOne(CLINIC_ID, 'p1');
      expect(service.findById).toHaveBeenCalledWith(CLINIC_ID, 'p1');
    });
  });

  // ─── update() ────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('delegates to service.update and has @Audit update metadata', async () => {
      await controller.update(CLINIC_ID, 'p1', {} as any);
      expect(service.update).toHaveBeenCalledWith(CLINIC_ID, 'p1', {});
      const audit = getAuditMetadata(ProductController.prototype.update);
      expect(audit).toMatchObject({ entity: 'Product', operation: 'update' });
    });
  });

  // ─── deactivate() ────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('delegates to service.deactivate and has @Audit status_change metadata', async () => {
      await controller.deactivate(CLINIC_ID, 'p1');
      expect(service.deactivate).toHaveBeenCalledWith(CLINIC_ID, 'p1');
      const audit = getAuditMetadata(ProductController.prototype.deactivate);
      expect(audit).toMatchObject({ entity: 'Product', operation: 'status_change' });
    });
  });

  // ─── getLowStock() ───────────────────────────────────────────────────────

  describe('getLowStock()', () => {
    it('passes active branch to service', async () => {
      await controller.getLowStock(CLINIC_ID, 'branch-1');
      expect(service.getLowStock).toHaveBeenCalledWith(CLINIC_ID, 'branch-1');
    });
  });
});
