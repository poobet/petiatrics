/**
 * Domain events emitted across bounded contexts.
 *
 * Consumers listen via @OnEvent('visit.finalized') etc.
 * All event classes are plain DTOs — no business logic here.
 */

/** Emitted when a vet finalizes a visit record */
export class VisitFinalizedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly visitId: string,
    public readonly patientId: string,
    public readonly vetId: string,
    public readonly branchId: string,
    public readonly finalizedAt: Date,
    /** IDs of products consumed during the visit (for inventory deduction) */
    public readonly productIds: string[],
  ) {}
}

/** Emitted when a product's stock falls at or below its reorder threshold */
export class LowStockEvent {
  constructor(
    public readonly clinicId: string,
    public readonly branchId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly currentQuantity: number,
    public readonly reorderThreshold: number,
  ) {}
}

/** Emitted when a new invoice is created */
export class InvoiceCreatedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly invoiceId: string,
    public readonly clientUserId: string,
    public readonly totalMinorUnits: number,
  ) {}
}

/** Emitted when an invoice is paid */
export class InvoicePaidEvent {
  constructor(
    public readonly clinicId: string,
    public readonly invoiceId: string,
    public readonly paidAt: Date,
  ) {}
}
