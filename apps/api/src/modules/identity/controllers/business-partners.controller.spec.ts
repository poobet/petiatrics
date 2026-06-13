import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BusinessPartnersController } from './business-partners.controller';
import { BusinessPartnerService } from '../services/business-partner.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { Role, Locale, BusinessPartnerType } from '@petiatrics/types';
import type { UserContext } from '@petiatrics/types';

// ---------------------------------------------------------------------------
// Bypass guards for unit tests — integration tests cover real guard behaviour
// ---------------------------------------------------------------------------
const allowGuard = { canActivate: () => true };

function makeUserContext(role: Role): UserContext {
  return {
    userId: 'user-1',
    clinicId: 'clinic-1',
    clinicName: 'Clinic',
    clinicSlug: 'clinic',
    role,
    permissions: [],
    preferredLocale: Locale.EN,
    authorizedBranches: [{ id: 'branch-1', name: 'Main' }],
  };
}

const mockBp = {
  id: 'bp-1',
  clinicId: 'clinic-1',
  type: BusinessPartnerType.VET,
  name: 'Dr. Somchai',
  isActive: true,
  user: null,
  vet: { licenseNumber: 'VET-001', whtRate: 3.0 },
  supplier: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeBpServiceMock() {
  return {
    list: jest.fn().mockResolvedValue([mockBp]),
    getById: jest.fn().mockResolvedValue(mockBp),
    create: jest.fn().mockResolvedValue(mockBp),
    update: jest.fn().mockResolvedValue(mockBp),
    deactivate: jest.fn().mockResolvedValue({ ...mockBp, isActive: false }),
  };
}

describe('BusinessPartnersController', () => {
  let controller: BusinessPartnersController;
  let bpService: ReturnType<typeof makeBpServiceMock>;

  beforeEach(async () => {
    bpService = makeBpServiceMock();
    const module = await Test.createTestingModule({
      controllers: [BusinessPartnersController],
      providers: [{ provide: BusinessPartnerService, useValue: bpService }],
    })
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .overrideGuard(BranchContextGuard)
      .useValue(allowGuard)
      .compile();

    controller = module.get(BusinessPartnersController);
  });

  // ─── GET /clinic/business-partners ─────────────────────────────────────────

  describe('list', () => {
    it('calls service.list with clinicId and query', async () => {
      const user = makeUserContext(Role.VET);
      await controller.list('clinic-1', {}, user);
      expect(bpService.list).toHaveBeenCalledWith('clinic-1', {}, false);
    });

    it('marks caller as manager for write roles', async () => {
      const user = makeUserContext(Role.CLINIC_OWNER);
      await controller.list('clinic-1', { includeInactive: true }, user);
      expect(bpService.list).toHaveBeenCalledWith('clinic-1', { includeInactive: true }, true);
    });

    it('marks caller as non-manager for VET role', async () => {
      const user = makeUserContext(Role.VET);
      await controller.list('clinic-1', { includeInactive: true }, user);
      expect(bpService.list).toHaveBeenCalledWith('clinic-1', { includeInactive: true }, false);
    });
  });

  // ─── GET /clinic/business-partners/:id ─────────────────────────────────────

  describe('getById', () => {
    it('returns BP from service', async () => {
      const result = await controller.getById('bp-1', 'clinic-1');
      expect(result.id).toBe('bp-1');
    });

    it('propagates NotFoundException from service', async () => {
      bpService.getById = jest.fn().mockRejectedValue(new NotFoundException());
      await expect(controller.getById('bad-id', 'clinic-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── POST /clinic/business-partners ────────────────────────────────────────

  describe('create', () => {
    it('creates BP and returns 201 response', async () => {
      const result = await controller.create(
        { type: BusinessPartnerType.VET, name: 'Dr. Somchai', vet: { licenseNumber: 'VET-001' } },
        'clinic-1',
      );
      expect(bpService.create).toHaveBeenCalled();
      expect(result.id).toBe('bp-1');
    });
  });

  // ─── PATCH /clinic/business-partners/:id ───────────────────────────────────

  describe('update', () => {
    it('delegates to service.update with correct args', async () => {
      const result = await controller.update('bp-1', { name: 'Dr. Updated' }, 'clinic-1');
      expect(bpService.update).toHaveBeenCalledWith('bp-1', 'clinic-1', { name: 'Dr. Updated' });
      expect(result).toEqual(mockBp);
    });
  });

  // ─── PATCH /clinic/business-partners/:id/deactivate ───────────────────────

  describe('deactivate', () => {
    it('soft-deletes the BP', async () => {
      const result = await controller.deactivate('bp-1', 'clinic-1');
      expect(bpService.deactivate).toHaveBeenCalledWith('bp-1', 'clinic-1');
      expect(result.isActive).toBe(false);
    });
  });
});
