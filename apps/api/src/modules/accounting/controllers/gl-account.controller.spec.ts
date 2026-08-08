import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, GLAccountType } from '@prisma/client';
import { GlAccountController } from './gl-account.controller';
import { GlAccountService } from '../services/gl-account.service';

describe('GlAccountController', () => {
  let controller: GlAccountController;
  let service: GlAccountService;

  const mockPrismaClient = {
    gLAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockGlAccountService = {
    deactivateAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlAccountController],
      providers: [
        {
          provide: PrismaClient,
          useValue: mockPrismaClient,
        },
        {
          provide: GlAccountService,
          useValue: mockGlAccountService,
        },
      ],
    }).compile();

    controller = module.get<GlAccountController>(GlAccountController);
    service = module.get<GlAccountService>(GlAccountService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of GL accounts ordered by code asc', async () => {
      const mockAccounts = [
        { id: '1', code: '1010', name: 'Cash', type: 'ASSET', isSystem: true, isActive: true },
        { id: '2', code: '1310', name: 'Inventory Asset', type: 'ASSET', isSystem: true, isActive: true },
      ];
      mockPrismaClient.gLAccount.findMany.mockResolvedValue(mockAccounts);

      const result = await controller.findAll('ASSET' as GLAccountType, 'true');

      expect(mockPrismaClient.gLAccount.findMany).toHaveBeenCalledWith({
        where: { type: 'ASSET', isActive: true },
        orderBy: { code: 'asc' },
      });
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if code already exists', async () => {
      mockPrismaClient.gLAccount.findUnique.mockResolvedValue({ id: '1', code: '6090' });

      await expect(
        controller.create({ code: '6090', name: 'Snacks Expense', type: 'EXPENSE' as GLAccountType })
      ).rejects.toThrow(ConflictException);
    });

    it('should create user-defined sub-account with isSystem: false', async () => {
      mockPrismaClient.gLAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.gLAccount.create.mockResolvedValue({
        id: 'new-id',
        code: '6090',
        name: 'Snacks Expense',
        type: 'EXPENSE',
        isSystem: false,
        isActive: true,
      });

      const result = await controller.create({
        code: '6090',
        name: 'Snacks Expense',
        type: 'EXPENSE' as GLAccountType,
      });

      expect(mockPrismaClient.gLAccount.create).toHaveBeenCalledWith({
        data: {
          code: '6090',
          name: 'Snacks Expense',
          type: 'EXPENSE',
          isSystem: false,
          isActive: true,
        },
      });
      expect(result.isSystem).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('should delegate to GlAccountService.deactivateAccount', async () => {
      mockGlAccountService.deactivateAccount.mockResolvedValue({ id: 'user-acc-1', isActive: false });

      const result = await controller.deactivate('user-acc-1');

      expect(mockGlAccountService.deactivateAccount).toHaveBeenCalledWith('user-acc-1');
      expect(result.isActive).toBe(false);
    });
  });
});
