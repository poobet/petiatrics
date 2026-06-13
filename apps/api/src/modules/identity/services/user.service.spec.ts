import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaClient } from '@prisma/client';
import { Role, UserStatus } from '@petiatrics/types';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prismaMock: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = {
      user: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'user-created-id', ...data }),
        ),
      },
      userBranch: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bpGroup: {
        findFirst: jest.fn().mockResolvedValue({ id: 'group-customer-1', prefix: 'C-' }),
        update: jest.fn().mockResolvedValue({}),
      },
      businessPartner: {
        create: jest.fn().mockResolvedValue({ id: 'bp-created-id', code: 'C-0001' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        { id: 'group-customer-1', prefix: 'C-', current_sequence: 0 },
      ]),
    };

    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(txMock)),
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'user-created-id', ...data }),
        ),
      },
      clinic: {
        findUnique: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
      },
      businessPartner: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clinicRolePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UserService);
  });

  describe('createStaff', () => {
    it('creates staff user successfully and does not create BP if role is not CUSTOMER', async () => {
      const result = await service.createStaff({
        usernamePrefix: 'john.vet',
        clinicSlug: 'happy-paws',
        clinicId: 'clinic-1',
        name: 'John Vet',
        temporaryPassword: 'Password1!',
        role: Role.VET,
      });

      expect(result.id).toBe('user-created-id');
      expect(txMock.user.create).toHaveBeenCalled();
      expect(txMock.businessPartner.create).not.toHaveBeenCalled();
    });

    it('creates customer user and automatically generates their BusinessPartner when role is CUSTOMER', async () => {
      const result = await service.createStaff({
        usernamePrefix: 'mochi.owner',
        clinicSlug: 'happy-paws',
        clinicId: 'clinic-1',
        name: 'Mochi Owner',
        temporaryPassword: 'Password1!',
        role: Role.CUSTOMER,
      });

      expect(result.id).toBe('user-created-id');
      expect(txMock.user.create).toHaveBeenCalled();
      expect(txMock.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: 'clinic-1',
            type: 'CUSTOMER',
            linkedUserId: 'user-created-id',
          }),
        }),
      );
    });
  });

  describe('invite', () => {
    it('invites a customer and generates BusinessPartner', async () => {
      const result = await service.invite({
        email: 'customer@test.com',
        role: Role.CUSTOMER,
        clinicId: 'clinic-1',
        invitedBy: 'vet-1',
      });

      expect(result.id).toBe('user-created-id');
      expect(txMock.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: 'clinic-1',
            type: 'CUSTOMER',
            email: 'customer@test.com',
          }),
        }),
      );
    });
  });

  describe('registerCustomer (Self-Registration)', () => {
    it('creates a user and automatically creates a linked BusinessPartner atomically', async () => {
      const result = await service.registerCustomer({
        clinicId: 'clinic-1',
        name: 'Jane Doe',
        email: 'jane@test.com',
        password: 'Password1!',
      });

      expect(result.id).toBe('user-created-id');
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(txMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'jane@test.com',
            role: 'CUSTOMER',
          }),
        }),
      );
      expect(txMock.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: 'clinic-1',
            type: 'CUSTOMER',
            email: 'jane@test.com',
            linkedUserId: 'user-created-id',
          }),
        }),
      );
    });

    it('throws ConflictException if email is already taken', async () => {
      prismaMock.user.findFirst = jest.fn().mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.registerCustomer({
          clinicId: 'clinic-1',
          name: 'Jane Doe',
          email: 'jane@test.com',
          password: 'Password1!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getRolePermissions', () => {
    it('returns custom role permissions for clinic', async () => {
      prismaMock.clinicRolePermission.findMany = jest.fn().mockResolvedValue([
        { id: 'perm-1', role: 'VET', permissions: ['VIEW_PATIENTS'] }
      ]);

      const result = await service.getRolePermissions('clinic-1');

      expect(prismaMock.clinicRolePermission.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1' }
      });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('VET');
    });
  });

  describe('updateRolePermissions', () => {
    it('upserts role permissions for clinic successfully', async () => {
      const mockResult = { clinicId: 'clinic-1', role: 'VET', permissions: ['VIEW_PATIENTS'] };
      prismaMock.clinicRolePermission.upsert = jest.fn().mockResolvedValue(mockResult);

      const result = await service.updateRolePermissions('clinic-1', Role.VET, ['VIEW_PATIENTS']);

      expect(prismaMock.clinicRolePermission.upsert).toHaveBeenCalledWith({
        where: {
          clinicId_role: {
            clinicId: 'clinic-1',
            role: 'VET'
          }
        },
        update: { permissions: ['VIEW_PATIENTS'] },
        create: {
          clinicId: 'clinic-1',
          role: 'VET',
          permissions: ['VIEW_PATIENTS']
        }
      });
      expect(result).toEqual(mockResult);
    });
  });
});
