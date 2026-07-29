import { Injectable } from '@nestjs/common';
import { PrismaClient, ResetInterval, SequenceScope } from '@prisma/client';

// String constants to replace the removed DocumentType enum
export const DOC_TYPE = {
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  GOODS_RECEIPT: 'GOODS_RECEIPT',
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
  CUSTOMER_INVOICE: 'CUSTOMER_INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
  APPOINTMENT: 'APPOINTMENT',
} as const;

export type DocTypeCode = typeof DOC_TYPE[keyof typeof DOC_TYPE] | string;

// System fallback defaults used when no DocumentTypeDefinition or DocumentSequenceConfig is found
const SYSTEM_DEFAULTS: Record<string, { template: string; resetInterval: ResetInterval }> = {
  PURCHASE_ORDER: { template: 'PO{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  GOODS_RECEIPT: { template: 'GR{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  PURCHASE_INVOICE: { template: 'PI{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  SUPPLIER_PAYMENT: { template: 'SP{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  CUSTOMER_INVOICE: { template: 'INV{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  CREDIT_NOTE: { template: 'CN{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  DEBIT_NOTE: { template: 'DN{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
  APPOINTMENT: { template: 'APT{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
};

@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prisma: PrismaClient) {}

  async generate(
    clinicId: string,
    documentType: string,
    date: Date = new Date(),
    branchId?: string,
  ): Promise<string> {
    // 1. Look up clinic-level override config first
    const clinicConfig = await this.prisma.documentSequenceConfig.findUnique({
      where: { clinicId_documentType: { clinicId, documentType } },
    });

    // 2. Fall back to DocumentTypeDefinition defaults (from DB registry)
    let template: string;
    let resetInterval: ResetInterval;
    let scope: SequenceScope = SequenceScope.CLINIC;

    if (clinicConfig) {
      template = clinicConfig.template;
      resetInterval = clinicConfig.resetInterval;
      scope = clinicConfig.scope;
    } else {
      // Try loading from DocumentTypeDefinition registry (system or clinic-specific)
      const typeDef = await this.prisma.documentTypeDefinition.findFirst({
        where: {
          code: documentType,
          OR: [{ clinicId: null }, { clinicId }],
          isActive: true,
        },
        orderBy: { clinicId: 'asc' }, // prefer clinic-specific over system
      });

      if (typeDef) {
        template = typeDef.defaultTemplate;
        resetInterval = typeDef.defaultResetInterval;
        scope = typeDef.scope;
      } else {
        // Hard-coded fallback if no DB record at all
        const fallback = SYSTEM_DEFAULTS[documentType] ?? {
          template: `${documentType}-{yyyy}-{number:4}`,
          resetInterval: ResetInterval.YEARLY,
        };
        template = fallback.template;
        resetInterval = fallback.resetInterval;
        scope = SequenceScope.CLINIC;
      }
    }

    // 3. Resolve calendar period string
    const yyyy = date.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    let period = 'GLOBAL';
    if (resetInterval === ResetInterval.YEARLY) period = yyyy;
    else if (resetInterval === ResetInterval.MONTHLY) period = `${yyyy}-${mm}`;
    else if (resetInterval === ResetInterval.DAILY) period = `${yyyy}-${mm}-${dd}`;

    // Resolve branchId partition
    const sequenceBranchId = (scope === SequenceScope.BRANCH && branchId) ? branchId : 'CLINIC';

    // 4. Concurrency-safe atomic upsert
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        clinicId_branchId_documentType_period: {
          clinicId,
          branchId: sequenceBranchId,
          documentType,
          period,
        },
      },
      create: { clinicId, branchId: sequenceBranchId, documentType, period, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    // 5. Format template placeholders
    let code = template;

    // Resolve {branchCode} if present
    if (code.includes('{branchCode}')) {
      let branchCodeStr = '';
      if (branchId) {
        const branch = await this.prisma.branch.findFirst({
          where: { id: branchId, clinicId },
        });
        branchCodeStr = branch?.code || '';
      }
      code = code.replace(/{branchCode}/g, branchCodeStr);
    }

    code = code.replace(/{yyyy}/g, yyyy);
    code = code.replace(/{yy}/g, yy);
    code = code.replace(/{mm}/g, mm);
    code = code.replace(/{dd}/g, dd);
    code = code.replace(/{number(?::(\d+))?}/g, (_, p1) => {
      const padding = p1 ? parseInt(p1, 10) : 4;
      return String(sequence.lastNumber).padStart(padding, '0');
    });

    return code;
  }

  /**
   * Get current running numbers for all document types in a clinic.
   * Returns the lastNumber and next number preview for each active document type.
   */
  async getCurrentSequences(clinicId: string, module?: string) {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    // Fetch all active document type definitions visible to this clinic
    const typeFilter: any = {
      OR: [{ clinicId: null }, { clinicId }],
      isActive: true,
    };
    if (module) {
      typeFilter.module = module;
    }

    const types = await this.prisma.documentTypeDefinition.findMany({
      where: typeFilter,
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });

    // Fetch clinic-level config overrides
    const configs = await this.prisma.documentSequenceConfig.findMany({
      where: { clinicId },
    });
    const configMap = new Map(configs.map(c => [c.documentType, c]));

    // Fetch all sequence records for this clinic
    const sequences = await this.prisma.documentSequence.findMany({
      where: { clinicId },
    });

    // Build result per document type
    return types.map(type => {
      const config = configMap.get(type.code);
      const template = config?.template ?? type.defaultTemplate;
      const resetInterval = config?.resetInterval ?? type.defaultResetInterval;
      const scope = config?.scope ?? type.scope;

      // Compute period based on reset interval
      let period = 'GLOBAL';
      if (resetInterval === ResetInterval.YEARLY) period = yyyy;
      else if (resetInterval === ResetInterval.MONTHLY) period = `${yyyy}-${mm}`;
      else if (resetInterval === ResetInterval.DAILY) period = `${yyyy}-${mm}-${dd}`;

      // Find matching sequence record
      const seq = sequences.find(
        s => s.documentType === type.code && s.period === period && s.branchId === 'CLINIC'
      );
      const lastNumber = seq?.lastNumber ?? 0;
      const nextNumber = lastNumber + 1;

      // Generate preview of next code
      let preview = template;
      preview = preview.replace(/{yyyy}/g, yyyy);
      preview = preview.replace(/{yy}/g, yyyy.slice(-2));
      preview = preview.replace(/{mm}/g, mm);
      preview = preview.replace(/{dd}/g, dd);
      preview = preview.replace(/{branchCode}/g, '');
      preview = preview.replace(/{number(?::(\d+))?}/g, (_: string, p1: string) => {
        const padding = p1 ? parseInt(p1, 10) : 4;
        return String(nextNumber).padStart(padding, '0');
      });

      return {
        documentType: type.code,
        label: type.label,
        module: type.module,
        template,
        resetInterval,
        scope,
        period,
        lastNumber,
        nextNumber,
        nextPreview: preview,
        isOverride: !!config,
      };
    });
  }
}
