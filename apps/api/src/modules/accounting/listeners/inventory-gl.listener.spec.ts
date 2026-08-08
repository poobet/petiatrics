import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { InventoryGlListener } from './inventory-gl.listener';
import { GLPostingService } from '../../billing/services/gl-posting.service';
import { RuleEvaluatorService } from '../services/rule-evaluator.service';
import { GoodsReceiptCompletedEvent, GoodsIssuedEvent } from '../../../common/events/domain-events';

describe('InventoryGlListener', () => {
  let listener: InventoryGlListener;
  let glPostingServiceMock: any;
  let ruleEvaluatorMock: any;
  let prismaMock: any;

  const mockAccounts: Record<string, { id: string; code: string; name: string }> = {
    '1310': { id: 'acc-1310', code: '1310', name: 'Inventory Asset' },
    '2110': { id: 'acc-2110', code: '2110', name: 'Accounts Payable' },
    '4110': { id: 'acc-4110', code: '4110', name: 'Revenue' },
    '5110': { id: 'acc-5110', code: '5110', name: 'Cost of Goods Sold' },
    '5290': { id: 'acc-5290', code: '5290', name: 'Write-down Loss (LCNRV)' },
  };

  beforeEach(async () => {
    glPostingServiceMock = {
      postJournal: jest.fn().mockResolvedValue({ id: 'journal-entry-1' }),
    };

    ruleEvaluatorMock = {
      evaluate: jest.fn().mockResolvedValue({
        matched: false,
        ruleName: null,
        action: null,
      }),
    };

    prismaMock = {
      gLAccount: {
        findUnique: jest.fn().mockImplementation(({ where: { code } }) => {
          return Promise.resolve(mockAccounts[code] ?? null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryGlListener,
        { provide: GLPostingService, useValue: glPostingServiceMock },
        { provide: RuleEvaluatorService, useValue: ruleEvaluatorMock },
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();

    listener = module.get<InventoryGlListener>(InventoryGlListener);
  });

  describe('handleGoodsReceipt', () => {
    it('should create standard Goods Receipt journal entry (Dr. Inventory Asset 1310, Cr. AP 2110)', async () => {
      const event = new GoodsReceiptCompletedEvent(
        'clinic-1',
        'branch-1',
        'prod-100',
        10, // qty
        5000, // 50.00 THB unit cost in satang
        null,
        'GRN-001',
        'REPLENISHMENT',
      );

      await listener.handleGoodsReceipt(event);

      expect(ruleEvaluatorMock.evaluate).toHaveBeenCalledWith(
        'inventory.goods_receipt_completed',
        expect.objectContaining({ productId: 'prod-100', quantity: 10 }),
        'clinic-1',
      );

      expect(glPostingServiceMock.postJournal).toHaveBeenCalledWith('clinic-1', {
        type: 'INVENTORY',
        description: expect.stringContaining('Goods Receipt – product prod-100'),
        sourceRefType: 'GOODS_RECEIPT',
        sourceRefId: 'GRN-001',
        lines: [
          { glAccountId: 'acc-1310', debitMinor: 50000, creditMinor: 0 },
          { glAccountId: 'acc-2110', debitMinor: 0, creditMinor: 50000 },
        ],
      });
    });

    it('should skip GL posting if total value is 0', async () => {
      const event = new GoodsReceiptCompletedEvent(
        'clinic-1',
        'branch-1',
        'prod-100',
        0,
        5000,
        null,
        'GRN-002',
        'REPLENISHMENT',
      );

      await listener.handleGoodsReceipt(event);

      expect(glPostingServiceMock.postJournal).not.toHaveBeenCalled();
    });
  });

  describe('handleGoodsIssued', () => {
    it('should create standard Goods Issue journal entry (Dr. COGS 5110, Cr. Inventory Asset 1310)', async () => {
      const event = new GoodsIssuedEvent(
        'clinic-1',
        'branch-1',
        'prod-100',
        2, // qty
        10000, // 100.00 THB unit cost in satang
        null,
        'GI-001',
        'MANUAL',
      );

      await listener.handleGoodsIssued(event);

      expect(glPostingServiceMock.postJournal).toHaveBeenCalledWith('clinic-1', {
        type: 'INVENTORY',
        description: expect.stringContaining('Goods Issue – product prod-100'),
        sourceRefType: 'GOODS_ISSUE',
        sourceRefId: 'GI-001',
        lines: [
          { glAccountId: 'acc-5110', debitMinor: 20000, creditMinor: 0 },
          { glAccountId: 'acc-1310', debitMinor: 0, creditMinor: 20000 },
        ],
      });
    });

    it('should dynamically evaluate rule (e.g. EXPIRED -> Dr. Write-down Loss 5290, Cr. Inventory Asset 1310)', async () => {
      ruleEvaluatorMock.evaluate.mockResolvedValueOnce({
        matched: true,
        ruleName: 'Expired Inventory Rule',
        action: { debitAccountCode: '5290', creditAccountCode: '1310' },
      });

      const event = new GoodsIssuedEvent(
        'clinic-1',
        'branch-1',
        'prod-100',
        5,
        2000, // 20.00 THB
        'EXPIRED',
        'GI-EXPIRED-001',
        'MANUAL',
      );

      await listener.handleGoodsIssued(event);

      expect(glPostingServiceMock.postJournal).toHaveBeenCalledWith('clinic-1', {
        type: 'INVENTORY',
        description: expect.stringContaining('[Rule: Expired Inventory Rule]'),
        sourceRefType: 'GOODS_ISSUE',
        sourceRefId: 'GI-EXPIRED-001',
        lines: [
          { glAccountId: 'acc-5290', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-1310', debitMinor: 0, creditMinor: 10000 },
        ],
      });
    });

    it('should enforce HARD RULE for SHRINKAGE (force Dr. Revenue 4110, Cr. Inventory Asset 1310) regardless of dynamic rules', async () => {
      // Dynamic rule evaluator should NOT even be called or its result must be ignored
      ruleEvaluatorMock.evaluate.mockResolvedValueOnce({
        matched: true,
        ruleName: 'Some Malicious Dynamic Rule',
        action: { debitAccountCode: '5110', creditAccountCode: '1310' },
      });

      const event = new GoodsIssuedEvent(
        'clinic-1',
        'branch-1',
        'prod-100',
        1,
        15000,
        'SHRINKAGE', // Unjustified inventory shortage!
        'ADJ-SHRINKAGE-001',
        'MANUAL',
      );

      await listener.handleGoodsIssued(event);

      // Verify RuleEvaluator is NOT evaluated for hard rules
      expect(ruleEvaluatorMock.evaluate).not.toHaveBeenCalled();

      // Verify hard rule posting: Dr. Revenue 4110 / Cr. Inventory Asset 1310
      expect(glPostingServiceMock.postJournal).toHaveBeenCalledWith('clinic-1', {
        type: 'INVENTORY',
        description: expect.stringContaining('[HARD RULE: Shortage treated as deemed sale]'),
        sourceRefType: 'GOODS_ISSUE',
        sourceRefId: 'ADJ-SHRINKAGE-001',
        lines: [
          { glAccountId: 'acc-4110', debitMinor: 15000, creditMinor: 0 },
          { glAccountId: 'acc-1310', debitMinor: 0, creditMinor: 15000 },
        ],
      });
    });
  });
});
