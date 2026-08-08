import { NotFoundException } from '@nestjs/common';
import { SystemRuleService } from './system-rule.service';

describe('SystemRuleService', () => {
  let service: SystemRuleService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      systemRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new SystemRuleService(prismaMock);
  });

  describe('create', () => {
    it('should create a SystemRule with correct data', async () => {
      const dto = {
        name: 'Expired Write-down',
        eventType: 'inventory.goods_issued',
        conditions: { reasonCode: 'EXPIRED' },
        action: { debitAccountCode: '5290', creditAccountCode: '1310' },
      };

      const expected = { id: 'rule-1', ...dto, clinicId: null, priority: 0, isActive: true };
      prismaMock.systemRule.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(prismaMock.systemRule.create).toHaveBeenCalledWith({
        data: {
          clinicId: null,
          name: 'Expired Write-down',
          description: null,
          eventType: 'inventory.goods_issued',
          priority: 0,
          conditions: { reasonCode: 'EXPIRED' },
          action: { debitAccountCode: '5290', creditAccountCode: '1310' },
          isActive: true,
        },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should list rules filtered by eventType', async () => {
      const rules = [{ id: 'rule-1', name: 'Test Rule' }];
      prismaMock.systemRule.findMany.mockResolvedValue(rules);

      const result = await service.findAll({ eventType: 'inventory.goods_issued' });

      expect(prismaMock.systemRule.findMany).toHaveBeenCalledWith({
        where: { eventType: 'inventory.goods_issued' },
        orderBy: { priority: 'desc' },
      });
      expect(result).toEqual(rules);
    });

    it('should list all rules when no filters provided', async () => {
      prismaMock.systemRule.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(prismaMock.systemRule.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { priority: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return rule when found', async () => {
      const rule = { id: 'rule-1', name: 'Test Rule' };
      prismaMock.systemRule.findUnique.mockResolvedValue(rule);

      const result = await service.findOne('rule-1');
      expect(result).toEqual(rule);
    });

    it('should throw NotFoundException when not found', async () => {
      prismaMock.systemRule.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a SystemRule', async () => {
      prismaMock.systemRule.findUnique.mockResolvedValue({ id: 'rule-1' });
      prismaMock.systemRule.update.mockResolvedValue({ id: 'rule-1', name: 'Updated' });

      const result = await service.update('rule-1', { name: 'Updated' });

      expect(prismaMock.systemRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { name: 'Updated' },
      });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when updating non-existent rule', async () => {
      prismaMock.systemRule.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a SystemRule', async () => {
      prismaMock.systemRule.findUnique.mockResolvedValue({ id: 'rule-1' });
      prismaMock.systemRule.delete.mockResolvedValue({ id: 'rule-1' });

      const result = await service.remove('rule-1');
      expect(prismaMock.systemRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
      expect(result.id).toBe('rule-1');
    });

    it('should throw NotFoundException when deleting non-existent rule', async () => {
      prismaMock.systemRule.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
