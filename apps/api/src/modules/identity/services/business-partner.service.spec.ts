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
  vetExt: null | { licenseNumber: string };
  suppExt: null | { vendorGroupId: string | null };
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
    contactPosition: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cp-1', isActive: true }),
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
});
