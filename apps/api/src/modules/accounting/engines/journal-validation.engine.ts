import { Injectable } from '@nestjs/common';
import { UnbalancedJournalEntryException, InvalidJournalEntryException } from '../exceptions/accounting.exceptions';

export interface JournalLineInput {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
  partnerId?: string;
  taxCodeId?: string;
  taxBaseMinor?: number;
  taxAmountMinor?: number;
  analyticAccountId?: string;
  memo?: string;
}

@Injectable()
export class JournalValidationEngine {
  validateLines(lines: JournalLineInput[]): void {
    if (!lines || lines.length < 2) {
      throw new InvalidJournalEntryException('A Journal Entry must contain at least 2 detail lines.');
    }

    let totalDebitSatang = 0;
    let totalCreditSatang = 0;

    for (const line of lines) {
      if (line.debitMinor < 0 || line.creditMinor < 0) {
        throw new InvalidJournalEntryException('Debit and Credit amounts must be non-negative.');
      }
      if (line.debitMinor > 0 && line.creditMinor > 0) {
        throw new InvalidJournalEntryException('A line item cannot contain both Debit and Credit amounts.');
      }
      if (line.debitMinor === 0 && line.creditMinor === 0) {
        throw new InvalidJournalEntryException('Line item must have either Debit or Credit greater than zero.');
      }

      totalDebitSatang += line.debitMinor;
      totalCreditSatang += line.creditMinor;
    }

    if (totalDebitSatang !== totalCreditSatang) {
      const diff = Math.abs(totalDebitSatang - totalCreditSatang);
      throw new UnbalancedJournalEntryException(
        `Unbalanced Journal Entry: Sum(Debit) = ${totalDebitSatang} Satang, Sum(Credit) = ${totalCreditSatang} Satang. Difference = ${diff} Satang.`
      );
    }
  }
}
