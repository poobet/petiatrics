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
    getAccounts: jest.fn(),
    createAccount: jest.fn(),
    deactivateAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlAccountController],
      providers: [
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
      mockGlAccountService.getAccounts.mockResolvedValue(mockAccounts);

      const result = await controller.findAll('clinic-1', 'ASSET' as GLAccountType, 'true');

      expect(mockGlAccountService.getAccounts).toHaveBeenCalledWith('clinic-1', {
        type: 'ASSET',
        isActive: true,
        search: undefined,
      });
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('create', () => {
    it('should create user-defined sub-account with clinicId scope', async () => {
      const createdAcc = {
        id: 'new-id',
        clinicId: 'clinic-1',
        code: '6090',
        name: 'Snacks Expense',
        type: 'EXPENSE',
        isSystem: false,
        isActive: true,
      };
      mockGlAccountService.createAccount.mockResolvedValue(createdAcc);

      const result = await controller.create('clinic-1', {
        code: '6090',
        name: 'Snacks Expense',
        type: 'EXPENSE' as GLAccountType,
      });

      expect(mockGlAccountService.createAccount).toHaveBeenCalledWith('clinic-1', {
        code: '6090',
        name: 'Snacks Expense',
        type: 'EXPENSE',
      });
      expect(result.isSystem).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('should delegate to GlAccountService.deactivateAccount with clinicId', async () => {
      mockGlAccountService.deactivateAccount.mockResolvedValue({ id: 'user-acc-1', isActive: false });

      const result = await controller.deactivate('clinic-1', 'user-acc-1');

      expect(mockGlAccountService.deactivateAccount).toHaveBeenCalledWith('clinic-1', 'user-acc-1');
      expect(result.isActive).toBe(false);
    });
  });
});
