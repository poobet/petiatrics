import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GlAccountService } from './gl-account.service';

describe('GlAccountService - Chart of Accounts (COA) Protected System Deletion Rules', () => {
  let service: GlAccountService;
  let prisma: PrismaClient;

  const mockPrismaClient = {
    gLAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlAccountService,
        {
          provide: PrismaClient,
          useValue: mockPrismaClient,
        },
      ],
    }).compile();

    service = module.get<GlAccountService>(GlAccountService);
    prisma = module.get<PrismaClient>(PrismaClient);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deactivateAccount / deleteAccount', () => {
    it('should throw NotFoundException if account does not exist', async () => {
      mockPrismaClient.gLAccount.findFirst.mockResolvedValue(null);

      await expect(service.deactivateAccount('clinic-1', 'non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if account is a Protected System Account (isSystem: true)', async () => {
      const systemAccount = {
        id: 'sys-acc-1',
        clinicId: null,
        code: '1310',
        name: 'Inventory Asset',
        type: 'ASSET',
        isSystem: true,
        isActive: true,
      };

      mockPrismaClient.gLAccount.findFirst.mockResolvedValue(systemAccount);

      await expect(service.deactivateAccount('clinic-1', 'sys-acc-1')).rejects.toThrow(
        ForbiddenException
      );

      expect(mockPrismaClient.gLAccount.update).not.toHaveBeenCalled();
    });

    it('should soft-delete (set isActive: false) if account is user-defined (isSystem: false)', async () => {
      const userAccount = {
        id: 'user-acc-1',
        clinicId: 'clinic-1',
        code: '6090',
        name: 'Custom Office Snacks Expense',
        type: 'EXPENSE',
        isSystem: false,
        isActive: true,
      };

      mockPrismaClient.gLAccount.findFirst.mockResolvedValue(userAccount);
      mockPrismaClient.gLAccount.update.mockResolvedValue({
        ...userAccount,
        isActive: false,
      });

      const result = await service.deactivateAccount('clinic-1', 'user-acc-1');

      expect(mockPrismaClient.gLAccount.update).toHaveBeenCalledWith({
        where: { id: 'user-acc-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
