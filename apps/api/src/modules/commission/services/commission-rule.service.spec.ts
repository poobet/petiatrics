import { Test, TestingModule } from '@nestjs/testing';
import { CommissionRuleService } from './commission-rule.service';
import { PrismaClient, CommissionType } from '@prisma/client';

describe('CommissionRuleService', () => {
  let service: CommissionRuleService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      businessPartner: {
        findFirst: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
      },
      commissionRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bpVet: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionRuleService,
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CommissionRuleService>(CommissionRuleService);
  });

  it('resolves item-level rule over BP default and BpVet default', async () => {
    prismaMock.commissionRule.findFirst
      .mockResolvedValueOnce({
        id: 'rule-item',
        commissionType: CommissionType.PERCENTAGE,
        rate: 50.0,
      });

    const result = await service.resolveRule('clinic-1', 'bp-1', 'prod-1');

    expect(result).toEqual({
      commissionType: CommissionType.PERCENTAGE,
      rate: 50.0,
      source: 'ITEM_OVERRIDE',
    });
  });

  it('resolves BP default rule when no item-level rule exists', async () => {
    // 1st call for item rule returns null
    prismaMock.commissionRule.findFirst
      .mockResolvedValueOnce(null)
      // 2nd call for BP default rule returns rule
      .mockResolvedValueOnce({
        id: 'rule-bp-default',
        commissionType: CommissionType.FLAT_RATE,
        rate: 15000,
      });

    const result = await service.resolveRule('clinic-1', 'bp-1', 'prod-1');

    expect(result).toEqual({
      commissionType: CommissionType.FLAT_RATE,
      rate: 15000,
      source: 'BP_DEFAULT',
    });
  });

  it('falls back to BpVet defaultDfRate when no commission rules exist', async () => {
    prismaMock.commissionRule.findFirst.mockResolvedValue(null);
    prismaMock.bpVet.findUnique.mockResolvedValue({
      bpId: 'bp-1',
      defaultDfRate: 20.0,
    });

    const result = await service.resolveRule('clinic-1', 'bp-1', 'prod-1');

    expect(result).toEqual({
      commissionType: CommissionType.PERCENTAGE,
      rate: 20.0,
      source: 'BP_VET_DEFAULT',
    });
  });

  it('returns null when no rule or default exists', async () => {
    prismaMock.commissionRule.findFirst.mockResolvedValue(null);
    prismaMock.bpVet.findUnique.mockResolvedValue(null);

    const result = await service.resolveRule('clinic-1', 'bp-1', 'prod-1');

    expect(result).toBeNull();
  });
});
