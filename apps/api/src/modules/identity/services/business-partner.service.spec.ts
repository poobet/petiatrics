import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessPartnerService } from './business-partner.service';
import { BusinessPartnerType } from '@petiatrics/types';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBp(overrides: Partial<{
  id: string;
  clinicId: string;
  type: string;
  name: string;
  isActive: boolean;
  user: null | { id: string; role: string; email: string | null; username: string | null };
  vetExt: null | { licenseNumber: string; specialty: string | null; defaultDfRate: { toNumber: () => number } | null };
  suppExt: null | { vendorGroupId: string | null };
  groupId: string | null;
  code: string | null;
  isMarketingOptIn: boolean;
  internalNotes: string | null;
  alertMessage: string | null;
  group: null | { id: string; name: string; prefix: string };
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'bp-1',
    clinicId: 'clinic-1',
    type: BusinessPartnerType.CUSTOMER,
    name: 'Test BP',
    isActive: true,
    // Thai compliance
    taxId: null,
    isHeadOffice: true,
    branchCode: null,
    addressLine1: null,
    subDistrict: null,
    district: null,
    province: null,
    zipcode: null,
    parentBpId: null,
    defaultVatCodeId: null,
    defaultWhtCodeId: null,
    // Payment
    creditTermDays: 0,
    // Communication
    phone: null,
    email: null,
    lineId: null,
    // Commercial
    creditLimit: null,
    creditHold: false,
    discountGroupId: null,
    // ERP / CRM fields
    groupId: null,
    code: null,
    isMarketingOptIn: false,
    internalNotes: null,
    alertMessage: null,
    group: null,
    // Bank
    bankAccountName: null,
    bankAccountBranch: null,
    bankAccountNumber: null,
    // Relations
    user: null,
    vetExt: null,
    suppExt: null,
    activeRoles: [],
    defaultVatCode: null,
    defaultWhtCode: null,
    contacts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma(bpRecord: ReturnType<typeof makeBp> | null = makeBp()) {
  const txFn: Record<string, jest.Mock> = {};
  void txFn;
  const tx = {
    businessPartner: {
      create: jest.fn().mockResolvedValue(bpRecord),
      update: jest.fn().mockImplementation((args: { data: unknown }) => {
        if (bpRecord) Object.assign(bpRecord, args.data);
        return Promise.resolve(bpRecord);
      }),
      findFirstOrThrow: jest.fn().mockResolvedValue(bpRecord),
      findFirst: jest.fn().mockResolvedValue(bpRecord),
    },
    bpVet: {
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    bpSupplier: {
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    bpContact: {
      createMany: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', clinicId: 'clinic-1', businessPartnerId: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    bpGroup: {
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return {
    businessPartner: {
      findMany: jest.fn().mockResolvedValue(bpRecord ? [bpRecord] : []),
      findFirst: jest.fn().mockResolvedValue(bpRecord),
      update: jest.fn().mockImplementation((args: { data: unknown }) => {
        if (bpRecord) Object.assign(bpRecord, args.data);
        return Promise.resolve(bpRecord);
      }),
    },
    bpVet: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    taxCode: {
      findUnique: jest.fn().mockResolvedValue({ id: 'tc-1', isActive: true }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    bpGroup: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    clinic: {
      findUnique: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', clinicId: 'clinic-1', businessPartnerId: null }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
}

describe('BusinessPartnerService', () => {
  let service: BusinessPartnerService;
  let prismaMock: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prismaMock = makePrisma();
    const module = await Test.createTestingModule({
      providers: [
        BusinessPartnerService,
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(BusinessPartnerService);
  });

  // ─── list ────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns active BPs for a clinic', async () => {
      const result = await service.list('clinic-1', {}, false);
      expect(Array.isArray(result)).toBe(true);
      expect(prismaMock.businessPartner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ clinicId: 'clinic-1', isActive: true }) }),
      );
    });

    it('includes inactive BPs when manager requests includeInactive', async () => {
      await service.list('clinic-1', { includeInactive: true }, true);
      const call = (prismaMock.businessPartner.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('isActive');
    });

    it('ignores includeInactive when caller is not a manager', async () => {
      await service.list('clinic-1', { includeInactive: true }, false);
      const call = (prismaMock.businessPartner.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toHaveProperty('isActive', true);
    });

    it('applies type filter when provided', async () => {
      await service.list('clinic-1', { type: BusinessPartnerType.VET }, false);
      const call = (prismaMock.businessPartner.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toHaveProperty('type', BusinessPartnerType.VET);
    });

    it('applies name search filter when provided', async () => {
      await service.list('clinic-1', { search: 'Dr.' }, false);
      const call = (prismaMock.businessPartner.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.name).toEqual(expect.objectContaining({ contains: 'Dr.' }));
    });

    it('enforces clinicId tenant isolation', async () => {
      await service.list('clinic-2', {}, false);
      expect(prismaMock.businessPartner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ clinicId: 'clinic-2' }) }),
      );
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns BP by id for the correct clinic', async () => {
      const bp = await service.getById('bp-1', 'clinic-1');
      expect(bp.id).toBe('bp-1');
    });

    it('throws NotFoundException when BP not found', async () => {
      prismaMock.businessPartner.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.getById('bad-id', 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('enforces clinicId scoping', async () => {
      prismaMock.businessPartner.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.getById('bp-1', 'other-clinic')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a Customer BP without extensions', async () => {
      const bp = await service.create('clinic-1', {
        type: BusinessPartnerType.CUSTOMER,
        name: 'Jane Doe',
      });
      expect(bp.type).toBe(BusinessPartnerType.CUSTOMER);
    });

    it('throws BadRequestException when VET type is missing licenseNumber', async () => {
      await expect(
        service.create('clinic-1', { type: BusinessPartnerType.VET, name: 'Dr. X' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when vet license already exists', async () => {
      prismaMock.bpVet.findUnique = jest.fn().mockResolvedValue({ bpId: 'other-bp' });
      await expect(
        service.create('clinic-1', {
          type: BusinessPartnerType.VET,
          name: 'Dr. X',
          vet: { licenseNumber: 'VET-001' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when linkUserId belongs to a different clinic', async () => {
      prismaMock.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', clinicId: 'other-clinic', businessPartnerId: null });
      await expect(
        service.create('clinic-1', {
          type: BusinessPartnerType.CUSTOMER,
          name: 'Test',
          linkUserId: 'user-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────────

  describe('deactivate (soft-delete)', () => {
    it('sets isActive to false', async () => {
      await service.deactivate('bp-1', 'clinic-1');
      expect(prismaMock.businessPartner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('throws NotFoundException when BP not found', async () => {
      prismaMock.businessPartner.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.deactivate('bad-id', 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when BP is already inactive', async () => {
      prismaMock.businessPartner.findFirst = jest.fn().mockResolvedValue(
        makeBp({ isActive: false }),
      );
      await expect(service.deactivate('bp-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('does NOT hard-delete — record remains queryable', async () => {
      await service.deactivate('bp-1', 'clinic-1');
      // update called, NOT delete
      expect(prismaMock.businessPartner.update).toHaveBeenCalled();
    });
  });

  // ─── listBpGroups ─────────────────────────────────────────────────────────

  describe('listBpGroups', () => {
    it('returns active groups for the clinic', async () => {
      const mockGroups = [
        { id: 'grp-1', name: 'Customers', prefix: 'C-', currentSequence: 5, isActive: true },
        { id: 'grp-2', name: 'Vets',      prefix: 'V-', currentSequence: 0, isActive: true },
      ];
      prismaMock.bpGroup.findMany = jest.fn().mockResolvedValue(mockGroups);

      const result = await service.listBpGroups('clinic-1');

      expect(prismaMock.bpGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 'clinic-1', isActive: true } }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'grp-1', name: 'Customers', prefix: 'C-', currentSequence: 5, isActive: true });
    });

    it('returns empty array when no groups', async () => {
      prismaMock.bpGroup.findMany = jest.fn().mockResolvedValue([]);
      const result = await service.listBpGroups('clinic-1');
      expect(result).toEqual([]);
    });
  });

  // ─── create — BpGroup code generation ─────────────────────────────────────

  describe('create — BpGroup code generation', () => {
    it('generates a code and increments sequence when groupId is supplied', async () => {
      const mockGroup = { id: 'grp-1', prefix: 'C-', currentSequence: 3 };
      // The $queryRaw on the tx must return the group row
      const bpRecord = makeBp({ groupId: 'grp-1', code: 'C-0004' });
      prismaMock = makePrisma(bpRecord);

      // Override the $transaction to capture tx.$queryRaw
      let capturedTx: any;
      prismaMock.$transaction = jest.fn().mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        capturedTx = {
          ...prismaMock,
          businessPartner: {
            ...prismaMock.businessPartner,
            create: jest.fn().mockResolvedValue(bpRecord),
            findFirstOrThrow: jest.fn().mockResolvedValue(bpRecord),
          },
          bpGroup: { update: jest.fn().mockResolvedValue({}) },
          bpVet: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
          bpSupplier: { create: jest.fn() },
          bpContact: { createMany: jest.fn().mockResolvedValue({}) },
          user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', clinicId: 'clinic-1', businessPartnerId: null }), update: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([mockGroup]),
        };
        return fn(capturedTx);
      });

      const module = await Test.createTestingModule({
        providers: [
          BusinessPartnerService,
          { provide: PrismaClient, useValue: prismaMock },
        ],
      }).compile();
      const svc = module.get(BusinessPartnerService);

      const result = await svc.create('clinic-1', {
        type: BusinessPartnerType.CUSTOMER,
        name: 'Jane',
        groupId: 'grp-1',
      });

      expect(capturedTx.$queryRaw).toHaveBeenCalled();
      expect(capturedTx.bpGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'grp-1' }, data: { currentSequence: 4 } }),
      );
      expect(result.code).toBe('C-0004');
    });

    it('throws BadRequestException when groupId is not found', async () => {
      const bpRecord = makeBp();
      prismaMock = makePrisma(bpRecord);
      prismaMock.$transaction = jest.fn().mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          businessPartner: { create: jest.fn().mockResolvedValue(bpRecord), findFirstOrThrow: jest.fn().mockResolvedValue(bpRecord) },
          bpGroup: { update: jest.fn() },
          bpVet: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
          bpSupplier: { create: jest.fn() },
          bpContact: { createMany: jest.fn() },
          user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1', clinicId: 'clinic-1', businessPartnerId: null }), update: jest.fn() },
          $queryRaw: jest.fn().mockResolvedValue([]), // empty — group not found
        };
        return fn(tx);
      });

      const module = await Test.createTestingModule({
        providers: [
          BusinessPartnerService,
          { provide: PrismaClient, useValue: prismaMock },
        ],
      }).compile();
      const svc = module.get(BusinessPartnerService);

      await expect(
        svc.create('clinic-1', { type: BusinessPartnerType.CUSTOMER, name: 'Jane', groupId: 'bad-group' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
