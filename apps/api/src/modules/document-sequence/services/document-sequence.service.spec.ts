import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, ResetInterval } from '@prisma/client';
import { DocumentSequenceService, DOC_TYPE } from './document-sequence.service';

function buildPrismaMock() {
  const configs: Record<string, any> = {};
  const sequences: Record<string, number> = {};

  return {
    configs,
    sequences,
    branch: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id,
          clinicId: where.clinicId,
          name: `Branch ${where.id}`,
          code: where.id === 'branch-1' ? 'BKK' : 'CNX',
        });
      }),
    },
    documentSequenceConfig: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.clinicId_documentType.clinicId}_${where.clinicId_documentType.documentType}`;
        const val = configs[key];
        return Promise.resolve(val ? { scope: 'CLINIC', ...val } : null);
      }),
    },
    // System-type registry fallback - returns null by default (falls back to hard-coded constants)
    documentTypeDefinition: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    documentSequence: {
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        const payload = where.clinicId_branchId_documentType_period;
        const key = `${payload.clinicId}_${payload.branchId}_${payload.documentType}_${payload.period}`;
        if (sequences[key] === undefined) {
          sequences[key] = create.lastNumber;
        } else {
          sequences[key] += 1;
        }
        return Promise.resolve({
          clinicId: payload.clinicId,
          branchId: payload.branchId,
          documentType: payload.documentType,
          period: payload.period,
          lastNumber: sequences[key],
        });
      }),
    },
  };
}

describe('DocumentSequenceService', () => {
  let service: DocumentSequenceService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSequenceService,
        {
          provide: PrismaClient,
          useValue: prismaMock as any,
        },
      ],
    }).compile();

    service = module.get<DocumentSequenceService>(DocumentSequenceService);
  });

  it('should generate code using system fallback template when no custom config exists', async () => {
    const code = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11)); // July 11, 2026
    expect(code).toBe('PO2026-0001');
  });

  it('should generate code using custom configuration template and padding', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'CUSTOM-PO-{yyyy}{mm}-{number:6}',
      resetInterval: ResetInterval.MONTHLY,
    };

    const code1 = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11));
    expect(code1).toBe('CUSTOM-PO-202607-000001');

    const code2 = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11));
    expect(code2).toBe('CUSTOM-PO-202607-000002');
  });

  it('should reset counters on month boundaries for monthly configuration', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'PO-{yyyy}{mm}-{number:4}',
      resetInterval: ResetInterval.MONTHLY,
    };

    const codeJul = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 15)); // July 15
    expect(codeJul).toBe('PO-202607-0001');

    const codeAug = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 7, 1)); // Aug 1
    expect(codeAug).toBe('PO-202608-0001');
  });

  it('should support daily resets', async () => {
    prismaMock.configs['clinic-123_GOODS_RECEIPT'] = {
      template: 'GR-{yyyy}{mm}{dd}-{number:3}',
      resetInterval: ResetInterval.DAILY,
    };

    const codeDay1 = await service.generate('clinic-123', DOC_TYPE.GOODS_RECEIPT, new Date(2026, 6, 11));
    expect(codeDay1).toBe('GR-20260711-001');

    const codeDay2 = await service.generate('clinic-123', DOC_TYPE.GOODS_RECEIPT, new Date(2026, 6, 12));
    expect(codeDay2).toBe('GR-20260712-001');
  });

  it('should support never resetting configuration', async () => {
    prismaMock.configs['clinic-123_APPOINTMENT'] = {
      template: 'APT-{number:5}',
      resetInterval: ResetInterval.NEVER,
    };

    const code1 = await service.generate('clinic-123', DOC_TYPE.APPOINTMENT, new Date(2026, 6, 11));
    expect(code1).toBe('APT-00001');

    const code2 = await service.generate('clinic-123', DOC_TYPE.APPOINTMENT, new Date(2027, 8, 25)); // Even way in future
    expect(code2).toBe('APT-00002');
  });

  it('should handle concurrent sequence generations sequentially without duplicates', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'PO-{number:4}',
      resetInterval: ResetInterval.NEVER,
    };

    const promises = Array.from({ length: 10 }).map(() =>
      service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11)),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);

    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(10);

    expect(results).toContain('PO-0001');
    expect(results).toContain('PO-0010');
  });

  it('should use a custom string document type with hard-coded fallback template', async () => {
    const code = await service.generate('clinic-123', 'MY_CUSTOM_DOC', new Date(2026, 6, 11));
    // Falls through to the hard-coded fallback: "{MY_CUSTOM_DOC}-{yyyy}-{number:4}"
    expect(code).toBe('MY_CUSTOM_DOC-2026-0001');
  });

  it('should generate independent sequence numbers per branch when scope is BRANCH', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'PO-{branchCode}-{number:4}',
      resetInterval: ResetInterval.NEVER,
      scope: 'BRANCH',
    };

    // branch-1
    const code1 = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11), 'branch-1');
    expect(code1).toBe('PO-BKK-0001');

    // branch-2
    const code2 = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11), 'branch-2');
    expect(code2).toBe('PO-CNX-0001');

    // branch-1 again (should increment to 2)
    const code3 = await service.generate('clinic-123', DOC_TYPE.PURCHASE_ORDER, new Date(2026, 6, 11), 'branch-1');
    expect(code3).toBe('PO-BKK-0002');
  });
});
