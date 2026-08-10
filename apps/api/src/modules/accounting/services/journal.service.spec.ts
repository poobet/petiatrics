import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalType, JournalStatus } from '@prisma/client';
import { LockedJournalEntryException } from '../exceptions/accounting.exceptions';

describe('JournalService', () => {
  let service: JournalService;
  let prismaMock: any;
  let sequenceServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      gLAccount: {
        findMany: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    sequenceServiceMock = {
      generate: jest.fn().mockResolvedValue('JV2026-0001'),
    };

    service = new JournalService(prismaMock, sequenceServiceMock);
  });

  describe('createJournalEntry', () => {
    it('should throw Error if debits and credits do not match', async () => {
      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Unbalanced entry',
        lines: [
          { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 8000 },
        ],
      };

      await expect(service.createJournalEntry(payload)).rejects.toThrow('Unbalanced Journal Entry');
    });

    it('should throw Error if less than 2 lines provided', async () => {
      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Single line entry',
        lines: [{ glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 }],
      };

      await expect(service.createJournalEntry(payload)).rejects.toThrow('must contain at least 2 detail lines');
    });

    it('should throw NotFoundException if referenced GL accounts do not exist', async () => {
      prismaMock.gLAccount.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1010', name: 'Cash', isActive: true },
      ]);

      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Invalid GL account',
        lines: [
          { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-invalid', debitMinor: 0, creditMinor: 10000 },
        ],
      };

      await expect(service.createJournalEntry(payload)).rejects.toThrow(NotFoundException);
    });

    it('should successfully create balanced journal entry in transaction', async () => {
      prismaMock.gLAccount.findMany.mockResolvedValue([
        { id: 'acc-1', code: '1010', name: 'Cash', isActive: true },
        { id: 'acc-2', code: '4002', name: 'Medical Revenue', isActive: true },
      ]);

      const expectedResult = {
        id: 'je-1',
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Medical Consultation',
        status: JournalStatus.POSTED,
        lines: [
          { id: 'jl-1', glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { id: 'jl-2', glAccountId: 'acc-2', debitMinor: 0, creditMinor: 10000 },
        ],
      };

      prismaMock.journalEntry.create.mockResolvedValue(expectedResult);

      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        type: JournalType.GENERAL,
        description: 'Medical Consultation',
        lines: [
          { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 10000 },
        ],
      };

      const result = await service.createJournalEntry(payload);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('immutability & reversal', () => {
    it('should throw LockedJournalEntryException when attempting to update a posted entry', async () => {
      prismaMock.journalEntry.findUnique.mockResolvedValue({
        id: 'je-posted',
        status: JournalStatus.POSTED,
      });

      await expect(service.updateJournalEntry('je-posted')).rejects.toThrow(LockedJournalEntryException);
    });

    it('should throw LockedJournalEntryException when attempting to delete a posted entry', async () => {
      prismaMock.journalEntry.findUnique.mockResolvedValue({
        id: 'je-posted',
        status: JournalStatus.POSTED,
      });

      await expect(service.deleteJournalEntry('je-posted')).rejects.toThrow(LockedJournalEntryException);
    });

    it('should successfully reverse a POSTED entry with swapped debit/credit lines', async () => {
      const originalEntry = {
        id: 'je-orig',
        clinicId: 'clinic-1',
        entryNo: 'JV-2026-001',
        type: JournalType.GENERAL,
        status: JournalStatus.POSTED,
        lines: [
          { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 9346 },
          { glAccountId: 'acc-3', debitMinor: 0, creditMinor: 654 },
        ],
      };

      prismaMock.journalEntry.findUnique.mockResolvedValue(originalEntry);
      sequenceServiceMock.generate.mockResolvedValue('JV-2026-002');

      const reversalResult = {
        id: 'je-rev',
        entryNo: 'JV-2026-002',
        status: JournalStatus.POSTED,
        lines: [
          { glAccountId: 'acc-1', debitMinor: 0, creditMinor: 10000 },
          { glAccountId: 'acc-2', debitMinor: 9346, creditMinor: 0 },
          { glAccountId: 'acc-3', debitMinor: 654, creditMinor: 0 },
        ],
      };

      prismaMock.journalEntry.create.mockResolvedValue(reversalResult);

      const result = await service.reverseJournalEntry('je-orig', 'Billing mistake');

      expect(result).toEqual(reversalResult);
      expect(prismaMock.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Reversal of JV-2026-001: Billing mistake',
          sourceRefType: 'REVERSAL',
          sourceRefId: 'je-orig',
          lines: {
            create: [
              { glAccountId: 'acc-1', debitMinor: 0, creditMinor: 10000, partnerId: undefined, taxCodeId: undefined, taxBaseMinor: undefined, taxAmountMinor: undefined, analyticAccountId: undefined, memo: 'Reversal line for JV-2026-001' },
              { glAccountId: 'acc-2', debitMinor: 9346, creditMinor: 0, partnerId: undefined, taxCodeId: undefined, taxBaseMinor: undefined, taxAmountMinor: undefined, analyticAccountId: undefined, memo: 'Reversal line for JV-2026-001' },
              { glAccountId: 'acc-3', debitMinor: 654, creditMinor: 0, partnerId: undefined, taxCodeId: undefined, taxBaseMinor: undefined, taxAmountMinor: undefined, analyticAccountId: undefined, memo: 'Reversal line for JV-2026-001' },
            ],
          },
        }),
        include: { lines: true },
      });
      expect(prismaMock.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'je-orig' },
        data: {
          status: JournalStatus.REVERSED,
          reversedByEntryId: 'je-rev',
        },
      });
    });
  });
});
