export class UnbalancedJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnbalancedJournalEntryException';
  }
}

export class InvalidJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJournalEntryException';
  }
}

export class LockedJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockedJournalEntryException';
  }
}

export class ClosedAccountingPeriodException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClosedAccountingPeriodException';
  }
}
