import { RuleEvaluatorService } from './rule-evaluator.service';

describe('RuleEvaluatorService', () => {
  let service: RuleEvaluatorService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      systemRule: {
        findMany: jest.fn(),
      },
    };
    service = new RuleEvaluatorService(prismaMock);
  });

  // ─── matchesConditions (unit tests for the condition parser) ────────────────

  describe('matchesConditions', () => {
    it('should match simple equality', () => {
      const result = service.matchesConditions(
        { reasonCode: 'EXPIRED' },
        { reasonCode: 'EXPIRED', quantity: 10 },
      );
      expect(result).toBe(true);
    });

    it('should not match when value differs', () => {
      const result = service.matchesConditions(
        { reasonCode: 'EXPIRED' },
        { reasonCode: 'STANDARD', quantity: 10 },
      );
      expect(result).toBe(false);
    });

    it('should match $eq operator', () => {
      const result = service.matchesConditions(
        { reasonCode: { $eq: 'EXPIRED' } },
        { reasonCode: 'EXPIRED' },
      );
      expect(result).toBe(true);
    });

    it('should match $ne operator', () => {
      const result = service.matchesConditions(
        { reasonCode: { $ne: 'STANDARD' } },
        { reasonCode: 'EXPIRED' },
      );
      expect(result).toBe(true);
    });

    it('should not match $ne when values are equal', () => {
      const result = service.matchesConditions(
        { reasonCode: { $ne: 'EXPIRED' } },
        { reasonCode: 'EXPIRED' },
      );
      expect(result).toBe(false);
    });

    it('should match $in operator', () => {
      const result = service.matchesConditions(
        { reasonCode: { $in: ['EXPIRED', 'DAMAGED'] } },
        { reasonCode: 'DAMAGED' },
      );
      expect(result).toBe(true);
    });

    it('should not match $in when value not in array', () => {
      const result = service.matchesConditions(
        { reasonCode: { $in: ['EXPIRED', 'DAMAGED'] } },
        { reasonCode: 'STANDARD' },
      );
      expect(result).toBe(false);
    });

    it('should match $gt operator', () => {
      const result = service.matchesConditions(
        { quantity: { $gt: 100 } },
        { quantity: 150 },
      );
      expect(result).toBe(true);
    });

    it('should not match $gt when value is equal', () => {
      const result = service.matchesConditions(
        { quantity: { $gt: 100 } },
        { quantity: 100 },
      );
      expect(result).toBe(false);
    });

    it('should match $lt operator', () => {
      const result = service.matchesConditions(
        { quantity: { $lt: 10 } },
        { quantity: 5 },
      );
      expect(result).toBe(true);
    });

    it('should match multiple conditions with AND logic', () => {
      const result = service.matchesConditions(
        { reasonCode: 'EXPIRED', referenceType: 'MANUAL' },
        { reasonCode: 'EXPIRED', referenceType: 'MANUAL', quantity: 10 },
      );
      expect(result).toBe(true);
    });

    it('should not match when any condition fails (AND logic)', () => {
      const result = service.matchesConditions(
        { reasonCode: 'EXPIRED', referenceType: 'REPLENISHMENT' },
        { reasonCode: 'EXPIRED', referenceType: 'MANUAL' },
      );
      expect(result).toBe(false);
    });
  });

  // ─── evaluate (integration with Prisma mock) ──────────────────────────────

  describe('evaluate', () => {
    it('should return matching rule action when conditions match', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Expired Write-down',
          conditions: { reasonCode: 'EXPIRED' },
          action: { debitAccountCode: '5290', creditAccountCode: '1310' },
          priority: 10,
          isActive: true,
        },
      ]);

      const result = await service.evaluate(
        'inventory.goods_issued',
        { reasonCode: 'EXPIRED', quantity: 5 },
        'clinic-1',
      );

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Expired Write-down');
      expect(result.action).toEqual({
        debitAccountCode: '5290',
        creditAccountCode: '1310',
      });
    });

    it('should return non-matched when no rules match', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Expired Write-down',
          conditions: { reasonCode: 'EXPIRED' },
          action: { debitAccountCode: '5290', creditAccountCode: '1310' },
          priority: 10,
          isActive: true,
        },
      ]);

      const result = await service.evaluate(
        'inventory.goods_issued',
        { reasonCode: 'STANDARD', quantity: 5 },
      );

      expect(result.matched).toBe(false);
      expect(result.ruleName).toBeNull();
      expect(result.action).toBeNull();
    });

    it('should respect priority ordering (highest first)', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([
        // Already ordered by priority DESC from the query
        {
          id: 'rule-high',
          name: 'High Priority Rule',
          conditions: { reasonCode: 'EXPIRED' },
          action: { debitAccountCode: '5290', creditAccountCode: '1310' },
          priority: 20,
          isActive: true,
        },
        {
          id: 'rule-low',
          name: 'Low Priority Rule',
          conditions: { reasonCode: 'EXPIRED' },
          action: { debitAccountCode: '9999', creditAccountCode: '1310' },
          priority: 5,
          isActive: true,
        },
      ]);

      const result = await service.evaluate(
        'inventory.goods_issued',
        { reasonCode: 'EXPIRED' },
      );

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('High Priority Rule');
      expect(result.action!.debitAccountCode).toBe('5290');
    });

    it('should return non-matched when rules list is empty', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([]);

      const result = await service.evaluate(
        'inventory.goods_issued',
        { reasonCode: 'EXPIRED' },
      );

      expect(result.matched).toBe(false);
    });

    it('should query with correct filters', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([]);

      await service.evaluate('inventory.goods_issued', {}, 'clinic-abc');

      expect(prismaMock.systemRule.findMany).toHaveBeenCalledWith({
        where: {
          eventType: 'inventory.goods_issued',
          isActive: true,
          OR: [
            { clinicId: 'clinic-abc' },
            { clinicId: null },
          ],
        },
        orderBy: { priority: 'desc' },
      });
    });
  });
});
