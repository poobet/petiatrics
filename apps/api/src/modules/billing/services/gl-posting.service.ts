import { BadRequestException, Injectable } from '@nestjs/common';
import { JournalType, PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

export interface CreateJournalLineDto {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
}

export interface CreateJournalEntryDto {
  type?: JournalType;
  description: string;
  sourceRefType?: string;
  sourceRefId?: string;
  lines: CreateJournalLineDto[];
}

@Injectable()
export class GLPostingService {
  constructor(private readonly prisma: PrismaClient) {}

  assertBalancedJournal(lines: CreateJournalLineDto[]): void {
    const totalDebit = lines.reduce((sum, l) => sum + (l.debitMinor || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.creditMinor || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Unbalanced Journal Entry! Total Debit (฿${(totalDebit / 100).toFixed(2)}) != Total Credit (฿${(totalCredit / 100).toFixed(2)}).`,
      );
    }
  }

  async postJournal(clinicId: string, dto: CreateJournalEntryDto) {
    this.assertBalancedJournal(dto.lines);
    const db = scopedPrisma(this.prisma, clinicId);

    const entryNo = `JV-${Date.now()}`;

    return db.journalEntry.create({
      data: {
        clinicId,
        entryNo,
        type: dto.type ?? 'GENERAL',
        description: dto.description,
        sourceRefType: dto.sourceRefType,
        sourceRefId: dto.sourceRefId,
        status: 'POSTED',
        lines: {
          create: dto.lines.map((l) => ({
            glAccountId: l.glAccountId,
            debitMinor: l.debitMinor,
            creditMinor: l.creditMinor,
          })),
        },
      },
      include: { lines: { include: { glAccount: true } } },
    });
  }

  async getTrialBalance(clinicId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const accounts = await db.gLAccount.findMany({ where: { isActive: true } });

    const report = [];
    for (const acc of accounts) {
      const lines = await db.journalLine.aggregate({
        where: { glAccountId: acc.id, journalEntry: { clinicId, status: 'POSTED' } },
        _sum: { debitMinor: true, creditMinor: true },
      });

      const totalDebit = lines._sum.debitMinor ?? 0;
      const totalCredit = lines._sum.creditMinor ?? 0;

      report.push({
        glAccountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debitMinor: totalDebit,
        creditMinor: totalCredit,
        balanceMinor: totalDebit - totalCredit,
      });
    }

    return report;
  }
}
