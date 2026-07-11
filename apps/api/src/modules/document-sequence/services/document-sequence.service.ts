import { Injectable } from '@nestjs/common';
import { PrismaClient, DocumentType, ResetInterval } from '@prisma/client';

@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly DEFAULT_CONFIGS: Record<DocumentType, { template: string; resetInterval: ResetInterval }> = {
    [DocumentType.PURCHASE_ORDER]: { template: 'PO{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    [DocumentType.GOODS_RECEIPT]: { template: 'GR{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    [DocumentType.PURCHASE_INVOICE]: { template: 'PI{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    [DocumentType.SUPPLIER_PAYMENT]: { template: 'SP{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    [DocumentType.CUSTOMER_INVOICE]: { template: 'INV{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    [DocumentType.APPOINTMENT]: { template: 'APT{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  };

  async generate(clinicId: string, documentType: DocumentType, date: Date = new Date()): Promise<string> {
    // 1. Fetch config or fall back
    const config = await this.prisma.documentSequenceConfig.findUnique({
      where: { clinicId_documentType: { clinicId, documentType } },
    }) || this.DEFAULT_CONFIGS[documentType];

    // 2. Resolve calendar period string
    const yyyy = date.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    let period = 'GLOBAL';
    if (config.resetInterval === ResetInterval.YEARLY) {
      period = yyyy;
    } else if (config.resetInterval === ResetInterval.MONTHLY) {
      period = `${yyyy}-${mm}`;
    } else if (config.resetInterval === ResetInterval.DAILY) {
      period = `${yyyy}-${mm}-${dd}`;
    }

    // 3. Concurrency-safe atomic upsert
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        clinicId_documentType_period: {
          clinicId,
          documentType,
          period,
        },
      },
      create: {
        clinicId,
        documentType,
        period,
        lastNumber: 1,
      },
      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

    // 4. Parse placeholders
    let code = config.template;
    code = code.replace(/{yyyy}/g, yyyy);
    code = code.replace(/{yy}/g, yy);
    code = code.replace(/{mm}/g, mm);
    code = code.replace(/{dd}/g, dd);

    // Resolve {number:X} globally
    code = code.replace(/{number(?::(\d+))?}/g, (_, p1) => {
      const padding = p1 ? parseInt(p1, 10) : 4;
      return String(sequence.lastNumber).padStart(padding, '0');
    });

    return code;
  }
}
