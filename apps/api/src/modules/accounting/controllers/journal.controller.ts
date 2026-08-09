import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JournalService, CreateJournalEntryPayload } from '../services/journal.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';

@Controller('accounting')
export class JournalController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly journalService: JournalService,
  ) {}

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
      where: { isActive: true },
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
