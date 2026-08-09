import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalType, JournalStatus } from '@prisma/client';

describe('JournalService', () => {
  let service: JournalService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      gLAccount: {
        findMany: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    service = new JournalService(prismaMock);
  });

  describe('createJournalEntry', () => {
    it('should throw BadRequestException if debits and credits do not match', async () => {
      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Unbalanced entry',
        lines: [
          { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
          { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 8000 },
        ],
      };

      await expect(service.createJournalEntry(payload)).rejects.toThrow(BadRequestException);
      await expect(service.createJournalEntry(payload)).rejects.toThrow('Debits and Credits must balance');
    });

    it('should throw BadRequestException if less than 2 lines provided', async () => {
      const payload = {
        clinicId: 'clinic-1',
        entryNo: 'JE-2026-001',
        description: 'Single line entry',
        lines: [{ glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 }],
      };

      await expect(service.createJournalEntry(payload)).rejects.toThrow(BadRequestException);
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
      expect(prismaMock.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: 'clinic-1',
          entryNo: 'JE-2026-001',
          description: 'Medical Consultation',
          lines: {
            create: [
              { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
              { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 10000 },
            ],
          },
        }),
        include: expect.anything(),
      });
    });
  });
});
