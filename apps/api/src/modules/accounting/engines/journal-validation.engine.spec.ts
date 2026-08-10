import { JournalValidationEngine } from './journal-validation.engine';
import { UnbalancedJournalEntryException, InvalidJournalEntryException } from '../exceptions/accounting.exceptions';

describe('JournalValidationEngine', () => {
  let engine: JournalValidationEngine;

  beforeEach(() => {
    engine = new JournalValidationEngine();
  });

  it('should pass validation when sum(debit) equals sum(credit)', () => {
    const validLines = [
      { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 9346 },
      { glAccountId: 'acc-3', debitMinor: 0, creditMinor: 654 },
    ];
    expect(() => engine.validateLines(validLines)).not.toThrow();
  });

  it('should throw UnbalancedJournalEntryException when sum(debit) != sum(credit)', () => {
    const unbalancedLines = [
      { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 9999 },
    ];
    expect(() => engine.validateLines(unbalancedLines)).toThrow(UnbalancedJournalEntryException);
  });

  it('should throw InvalidJournalEntryException when fewer than 2 lines provided', () => {
    const singleLine = [{ glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 }];
    expect(() => engine.validateLines(singleLine)).toThrow(InvalidJournalEntryException);
  });

  it('should throw InvalidJournalEntryException when line has negative amounts', () => {
    const invalidLines = [
      { glAccountId: 'acc-1', debitMinor: -100, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 100 },
    ];
    expect(() => engine.validateLines(invalidLines)).toThrow(InvalidJournalEntryException);
  });

  it('should throw InvalidJournalEntryException when line has both debit and credit > 0', () => {
    const invalidLines = [
      { glAccountId: 'acc-1', debitMinor: 100, creditMinor: 50 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 50 },
    ];
    expect(() => engine.validateLines(invalidLines)).toThrow(InvalidJournalEntryException);
  });
});
