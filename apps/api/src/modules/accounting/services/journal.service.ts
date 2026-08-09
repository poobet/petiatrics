import { Injectable, BadRequestException, NotFoundException, Optional, Inject } from '@nestjs/common';
import { PrismaClient, JournalType, JournalStatus } from '@prisma/client';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';

export interface CreateJournalLinePayload {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
  description?: string;
}

export interface CreateJournalEntryPayload {
  clinicId: string;
  entryNo?: string;
  type?: JournalType;
  description: string;
  sourceRefType?: string;
  sourceRefId?: string;
  postedAt?: Date;
  lines: CreateJournalLinePayload[];
}

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
  ) {}

  /**
   * Creates a double-entry Journal Entry with strict balanced debit/credit validation.
   *
   * Business Rules:
   * 1. Must contain at least two journal lines.
   * 2. Sum of all Debit amounts must EQUAL the sum of all Credit amounts (totalDebit === totalCredit).
   * 3. Total Debit/Credit must be greater than 0.
   * 4. Each glAccountId must exist and be active.
   * 5. Atomically saves JournalEntry and JournalLine records using a Prisma transaction.
   */
  async createJournalEntry(payload: CreateJournalEntryPayload) {
    if (!payload.lines || payload.lines.length < 2) {
      throw new BadRequestException('A valid double-entry journal entry must contain at least 2 lines.');
    }

    // Auto-generate system document sequence entryNo (e.g. JV2026-0001)
    const entryNo =
      payload.entryNo?.trim() ||
      (await this.sequenceService.generate(payload.clinicId, DOC_TYPE.JOURNAL_ENTRY));

    // Calculate total debits and credits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of payload.lines) {
      if (line.debitMinor < 0 || line.creditMinor < 0) {
        throw new BadRequestException('Debit and credit amounts cannot be negative.');
      }
      totalDebit += line.debitMinor;
      totalCredit += line.creditMinor;
    }

    // Strict Double-Entry Balancing Rule
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Debits and Credits must balance. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}.`
      );
    }

    if (totalDebit === 0) {
      throw new BadRequestException('Journal Entry total amount must be greater than 0.');
    }

    // Validate GL Accounts exist and belong to system or active clinic
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

    // Transactionally create JournalEntry and JournalLine items
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          clinicId: payload.clinicId,
          entryNo: entryNo,
          type: payload.type ?? JournalType.GENERAL,
          description: payload.description,
          sourceRefType: payload.sourceRefType,
          sourceRefId: payload.sourceRefId,
          postedAt: payload.postedAt ?? new Date(),
          status: JournalStatus.POSTED,
          lines: {
            create: payload.lines.map((line) => ({
              glAccountId: line.glAccountId,
              debitMinor: line.debitMinor,
              creditMinor: line.creditMinor,
            })),
          },
        },
        include: {
          lines: {
            include: {
              glAccount: true,
            },
          },
        },
      });

      return entry;
    });
  }

  /**
   * Retrieves a Journal Entry by ID including lines and GL accounts.
   */
  async getJournalEntryById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            glAccount: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal Entry with ID "${id}" was not found.`);
    }

    return entry;
  }
}
