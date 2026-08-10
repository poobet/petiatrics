import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, JournalType, JournalStatus } from '@prisma/client';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { JournalValidationEngine, JournalLineInput } from '../engines/journal-validation.engine';
import { LockedJournalEntryException } from '../exceptions/accounting.exceptions';

export interface CreateJournalLinePayload {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
  partnerId?: string;
  taxCodeId?: string;
  taxBaseMinor?: number;
  taxAmountMinor?: number;
  analyticAccountId?: string;
  memo?: string;
  description?: string;
}

export interface CreateJournalEntryPayload {
  clinicId: string;
  branchId?: string;
  entryNo?: string;
  type?: JournalType;
  description: string;
  sourceRefType?: string;
  sourceRefId?: string;
  documentDate?: Date;
  accountingDate?: Date;
  postedAt?: Date;
  postedById?: string;
  lines: CreateJournalLinePayload[];
}

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
    private readonly validationEngine: JournalValidationEngine = new JournalValidationEngine(),
  ) {}

  /**
   * Creates a double-entry Journal Entry with strict balanced debit/credit validation.
   */
  async createJournalEntry(payload: CreateJournalEntryPayload) {
    // 1. Validate line math and double-entry balancing rule
    this.validationEngine.validateLines(payload.lines);

    // 2. Auto-generate system document sequence entryNo (e.g. JV2026-0001)
    const entryNo =
      payload.entryNo?.trim() ||
      (await this.sequenceService.generate(payload.clinicId, DOC_TYPE.JOURNAL_ENTRY));

    // 3. Validate GL Accounts exist and belong to system or active clinic
    const glAccountIds = Array.from(new Set(payload.lines.map((l) => l.glAccountId)));
    const accounts = await this.prisma.gLAccount.findMany({
      where: {
        id: { in: glAccountIds },
        isActive: true,
        OR: [{ clinicId: null }, { clinicId: payload.clinicId }],
      },
    });

    if (accounts.length !== glAccountIds.length) {
      throw new NotFoundException('One or more referenced GL Accounts do not exist or are inactive.');
    }

    // 4. Transactionally create JournalEntry and JournalLine items
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          clinicId: payload.clinicId,
          branchId: payload.branchId,
          entryNo: entryNo,
          type: payload.type ?? JournalType.GENERAL,
          description: payload.description,
          sourceRefType: payload.sourceRefType,
          sourceRefId: payload.sourceRefId,
          documentDate: payload.documentDate ?? new Date(),
          accountingDate: payload.accountingDate ?? new Date(),
          postedAt: payload.postedAt ?? new Date(),
          postedById: payload.postedById,
          status: JournalStatus.POSTED,
          lines: {
            create: payload.lines.map((line) => ({
              glAccountId: line.glAccountId,
              debitMinor: line.debitMinor,
              creditMinor: line.creditMinor,
              partnerId: line.partnerId,
              taxCodeId: line.taxCodeId,
              taxBaseMinor: line.taxBaseMinor,
              taxAmountMinor: line.taxAmountMinor,
              analyticAccountId: line.analyticAccountId,
              memo: line.memo || line.description,
            })),
          },
        },
        include: {
          lines: {
            include: {
              glAccount: true,
              analyticAccount: true,
            },
          },
        },
      });

      return entry;
    });
  }

  /**
   * Retrieves a Journal Entry by ID including lines, GL accounts, and analytic accounts.
   */
  async getJournalEntryById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            glAccount: true,
            analyticAccount: true,
          },
        },
        reversedByEntry: true,
        reversingEntries: true,
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal Entry with ID "${id}" was not found.`);
    }

    return entry;
  }

  /**
   * Reverses a POSTED journal entry by generating an immutable counter-entry with swapped Dr/Cr lines.
   */
  async reverseJournalEntry(id: string, reason: string, userId?: string) {
    const original = await this.getJournalEntryById(id);

    if (original.status !== JournalStatus.POSTED) {
      throw new BadRequestException(`Only POSTED journal entries can be reversed. Current status is ${original.status}.`);
    }

    const reversalEntryNo = await this.sequenceService.generate(original.clinicId, DOC_TYPE.JOURNAL_ENTRY);

    return this.prisma.$transaction(async (tx) => {
      // Create reversal entry with swapped lines
      const reversal = await tx.journalEntry.create({
        data: {
          clinicId: original.clinicId,
          branchId: original.branchId,
          entryNo: reversalEntryNo,
          type: original.type,
          description: `Reversal of ${original.entryNo}: ${reason}`,
          sourceRefType: 'REVERSAL',
          sourceRefId: original.id,
          documentDate: new Date(),
          accountingDate: new Date(),
          postedAt: new Date(),
          postedById: userId,
          status: JournalStatus.POSTED,
          lines: {
            create: original.lines.map((line) => ({
              glAccountId: line.glAccountId,
              debitMinor: line.creditMinor, // Swapped
              creditMinor: line.debitMinor, // Swapped
              partnerId: line.partnerId,
              taxCodeId: line.taxCodeId,
              taxBaseMinor: line.taxBaseMinor,
              taxAmountMinor: line.taxAmountMinor,
              analyticAccountId: line.analyticAccountId,
              memo: `Reversal line for ${original.entryNo}`,
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      // Update original entry status to REVERSED and point to reversal entry
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalStatus.REVERSED,
          reversedByEntryId: reversal.id,
        },
      });

      return reversal;
    });
  }

  /**
   * Prevents editing posted journal entries to comply with Thai accounting laws.
   */
  async updateJournalEntry(id: string) {
    const entry = await this.getJournalEntryById(id);
    if (entry.status === JournalStatus.POSTED) {
      throw new LockedJournalEntryException('Posted journal entries are immutable and cannot be updated.');
    }
    throw new BadRequestException('Operation not allowed.');
  }

  /**
   * Prevents deleting posted journal entries to comply with Thai accounting laws.
   */
  async deleteJournalEntry(id: string) {
    const entry = await this.getJournalEntryById(id);
    if (entry.status === JournalStatus.POSTED) {
      throw new LockedJournalEntryException('Posted journal entries are immutable and cannot be deleted.');
    }
    return this.prisma.journalEntry.delete({ where: { id } });
  }
}
