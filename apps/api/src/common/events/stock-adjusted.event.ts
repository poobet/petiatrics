/**
 * Domain Event emitted when a stock adjustment is committed.
 * Caught by the Accounting Rule Engine (Phase 1) to post double-entry GL journals and VAT liabilities.
 */
export class StockAdjustedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly branchId: string,
    public readonly adjustmentId: string,
    public readonly productId: string,
    public readonly quantity: number,               // Delta (positive = surplus, negative = deficit)
    public readonly unitCostMinor: number,           // Unit cost in Satang (minor units)
    public readonly totalCostMinor: number,          // Total adjustment cost in Satang
    public readonly reasonCodeId: string,            // Predefined ReasonCode ID
    public readonly reasonCode: string,              // e.g. "EXPIRED", "MISSING_UNKNOWN"
    public readonly requiresVatCalculation: boolean, // True for Thai Revenue Dept Deemed Sale (Output VAT)
    public readonly reasonType: string,              // "EXPIRED" | "SHRINKAGE" | "DAMAGE" | "ADJUSTMENT"
    public readonly adjustedBy: string,              // User ID of performing staff
    public readonly timestamp: Date = new Date(),
  ) {}
}
