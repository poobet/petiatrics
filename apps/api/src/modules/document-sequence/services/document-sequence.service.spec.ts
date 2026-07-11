import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, DocumentType, ResetInterval } from '@prisma/client';
import { DocumentSequenceService } from './document-sequence.service';

function buildPrismaMock() {
  const configs: Record<string, any> = {};
  const sequences: Record<string, number> = {};

  return {
    configs,
    sequences,
    documentSequenceConfig: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.clinicId_documentType.clinicId}_${where.clinicId_documentType.documentType}`;
        return Promise.resolve(configs[key] || null);
      }),
    },
    documentSequence: {
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const key = `${where.clinicId_documentType_period.clinicId}_${where.clinicId_documentType_period.documentType}_${where.clinicId_documentType_period.period}`;
        if (sequences[key] === undefined) {
          sequences[key] = create.lastNumber;
        } else {
          sequences[key] += 1;
        }
        return Promise.resolve({
          clinicId: where.clinicId_documentType_period.clinicId,
          documentType: where.clinicId_documentType_period.documentType,
          period: where.clinicId_documentType_period.period,
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
    const code = await service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 6, 11)); // July 11, 2026
    expect(code).toBe('PO2026-0001');
  });

  it('should generate code using custom configuration template and padding', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'CUSTOM-PO-{yyyy}{mm}-{number:6}',
      resetInterval: ResetInterval.MONTHLY,
    };

    const code1 = await service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 6, 11));
    expect(code1).toBe('CUSTOM-PO-202607-000001');

    const code2 = await service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 6, 11));
    expect(code2).toBe('CUSTOM-PO-202607-000002');
  });

  it('should reset counters on month boundaries for monthly configuration', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'PO-{yyyy}{mm}-{number:4}',
      resetInterval: ResetInterval.MONTHLY,
    };

    const codeJul = await service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 6, 15)); // July 15
    expect(codeJul).toBe('PO-202607-0001');

    const codeAug = await service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 7, 1)); // Aug 1
    expect(codeAug).toBe('PO-202608-0001');
  });

  it('should support daily resets', async () => {
    prismaMock.configs['clinic-123_GOODS_RECEIPT'] = {
      template: 'GR-{yyyy}{mm}{dd}-{number:3}',
      resetInterval: ResetInterval.DAILY,
    };

    const codeDay1 = await service.generate('clinic-123', DocumentType.GOODS_RECEIPT, new Date(2026, 6, 11));
    expect(codeDay1).toBe('GR-20260711-001');

    const codeDay2 = await service.generate('clinic-123', DocumentType.GOODS_RECEIPT, new Date(2026, 6, 12));
    expect(codeDay2).toBe('GR-20260712-001');
  });

  it('should support never resetting configuration', async () => {
    prismaMock.configs['clinic-123_APPOINTMENT'] = {
      template: 'APT-{number:5}',
      resetInterval: ResetInterval.NEVER,
    };

    const code1 = await service.generate('clinic-123', DocumentType.APPOINTMENT, new Date(2026, 6, 11));
    expect(code1).toBe('APT-00001');

    const code2 = await service.generate('clinic-123', DocumentType.APPOINTMENT, new Date(2027, 8, 25)); // Even way in future
    expect(code2).toBe('APT-00002');
  });

  it('should handle concurrent sequence generations sequentially without duplicates', async () => {
    prismaMock.configs['clinic-123_PURCHASE_ORDER'] = {
      template: 'PO-{number:4}',
      resetInterval: ResetInterval.NEVER,
    };

    const promises = Array.from({ length: 10 }).map(() =>
      service.generate('clinic-123', DocumentType.PURCHASE_ORDER, new Date(2026, 6, 11)),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);

    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(10);

    expect(results).toContain('PO-0001');
    expect(results).toContain('PO-0010');
  });
});
