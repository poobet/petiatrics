import { Controller, Get, Post, Body, Param, Query, Optional, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JournalService, CreateJournalEntryPayload } from '../services/journal.service';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';

@Controller('accounting')
export class JournalController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly journalService: JournalService,
    private readonly sequenceService: DocumentSequenceService,
  ) {}

  /**
   * Returns next system running entry number preview for manual journal entries.
   */
  @Get('journal-entries/next-number')
  async getNextEntryNumber(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
  ) {
    const clinicId = tenantId || queryClinicId || 'clinic-1';
    if (this.sequenceService) {
      const seqs = await this.sequenceService.getCurrentSequences(clinicId, 'ACCOUNTING');
      const jeSeq = seqs.find((s) => s.documentType === DOC_TYPE.JOURNAL_ENTRY);
      if (jeSeq) {
        return { nextEntryNo: jeSeq.nextPreview };
      }
    }
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return { nextEntryNo: `JV${yyyy}${mm}-0001` };
  }

  /**
   * Retrieves Trial Balance report with aggregated debit, credit, and balance per GL Account.
   */
  @Get('trial-balance')
  async getTrialBalance(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
  ) {
    const clinicId = tenantId || queryClinicId || 'clinic-1';

    const accounts = await this.prisma.gLAccount.findMany({
      where: {
        isActive: true,
        ...(clinicId ? { OR: [{ clinicId: null }, { clinicId }] } : {}),
      },
      orderBy: { code: 'asc' },
    });

    const report = [];
    for (const acc of accounts) {
      const aggregate = await this.prisma.journalLine.aggregate({
        where: {
          glAccountId: acc.id,
          journalEntry: {
            status: 'POSTED',
            ...(clinicId ? { clinicId } : {}),
          },
        },
        _sum: { debitMinor: true, creditMinor: true },
      });

      const debitMinor = aggregate._sum.debitMinor ?? 0;
      const creditMinor = aggregate._sum.creditMinor ?? 0;

      report.push({
        glAccountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isSystem: acc.isSystem,
        debitMinor,
        creditMinor,
        balanceMinor: debitMinor - creditMinor,
      });
    }

    return report;
  }

  /**
   * Lists all posted Journal Entries with nested JournalLines.
   */
  @Get('journal-entries')
  async getJournalEntries(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
    @Query('search') search?: string,
  ) {
    const clinicId = tenantId || queryClinicId;
    const where: any = {
      ...(clinicId ? { clinicId } : {}),
    };

    if (search) {
      where.OR = [
        { entryNo: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sourceRefId: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            glAccount: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
    });
  }

  /**
   * Retrieves single Journal Entry by ID.
   */
  @Get('journal-entries/:id')
  async getJournalEntryById(@Param('id') id: string) {
    return this.journalService.getJournalEntryById(id);
  }

  /**
   * Posts a new balanced double-entry Journal Entry.
   */
  @Post('journal-entries')
  async createJournalEntry(
    @TenantId() tenantId: string | undefined,
    @Body() payload: CreateJournalEntryPayload,
  ) {
    const clinicId = payload.clinicId || tenantId || 'clinic-1';
    return this.journalService.createJournalEntry({
      ...payload,
      clinicId,
    });
  }
}
