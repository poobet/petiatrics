import { Injectable } from '@nestjs/common';
import { PrismaClient, InvoiceMatchStatus, MatchDiscrepancyType } from '@prisma/client';

export interface MatchResult {
  status: InvoiceMatchStatus;
  lineResults: LineMatchResult[];
  summary: {
    totalLines: number;
    matchedLines: number;
    toleranceApprovedLines: number;
    exceptionLines: number;
  };
}

export interface LineMatchResult {
  invoiceLineId: string;
  productId: string;
  productName: string;
  poQuantity: number | null;
  grQuantity: number | null;
  invoiceQuantity: number;
  poUnitPrice: number | null;
  invoiceUnitPrice: number;
  quantityVariancePercent: number | null;
  priceVariancePercent: number | null;
  discrepancyType: MatchDiscrepancyType | null;
  tolerancePercent: number;
  withinTolerance: boolean;
  status: InvoiceMatchStatus;
}

@Injectable()
export class ThreeWayMatchingService {
  constructor(private readonly prisma: PrismaClient) {}

  async performMatch(clinicId: string, purchaseInvoiceId: string): Promise<MatchResult> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: purchaseInvoiceId, clinicId },
      include: {
        lines: {
          include: {
            product: { include: { category: true } },
            poLine: true,
            grLine: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error(`Purchase Invoice ${purchaseInvoiceId} not found`);
    }

    const lineResults: LineMatchResult[] = [];

    for (const line of invoice.lines) {
      // Get tolerance for this product's category
      const tolerance = await this.getToleranceForProduct(clinicId, line.product.categoryId);

      const poQty = line.poLine ? Number(line.poLine.quantityOrdered) : null;
      const grQty = line.grLine ? Number(line.grLine.quantityReceived) : null;
      const invQty = Number(line.quantity);
      const poPrice = line.poLine ? line.poLine.unitPriceMinor : null;
      const invPrice = line.unitPriceMinor;

      // Calculate variances (percentage difference)
      let qtyVariance: number | null = null;
      if (grQty !== null && grQty !== 0) {
        qtyVariance = Math.abs((invQty - grQty) / grQty) * 100;
      } else if (grQty !== null && grQty === 0 && invQty !== 0) {
        qtyVariance = 100; // Full mismatch: GR=0 but invoice has quantity
      }

      let priceVariance: number | null = null;
      if (poPrice !== null && poPrice !== 0) {
        priceVariance = Math.abs((invPrice - poPrice) / poPrice) * 100;
      } else if (poPrice !== null && poPrice === 0 && invPrice !== 0) {
        priceVariance = 100; // Full mismatch: PO price=0 but invoice has price
      }

      // Determine discrepancy type
      let discrepancyType: MatchDiscrepancyType | null = null;
      const hasQtyMismatch = qtyVariance !== null && qtyVariance > 0;
      const hasPriceMismatch = priceVariance !== null && priceVariance > 0;

      if (hasQtyMismatch && hasPriceMismatch) {
        discrepancyType = MatchDiscrepancyType.BOTH;
      } else if (hasQtyMismatch) {
        discrepancyType = MatchDiscrepancyType.QUANTITY;
      } else if (hasPriceMismatch) {
        discrepancyType = MatchDiscrepancyType.PRICE;
      }

      // Within tolerance check
      const qtyOk = qtyVariance === null || qtyVariance <= tolerance;
      const priceOk = priceVariance === null || priceVariance <= tolerance;
      const withinTolerance = qtyOk && priceOk;

      let lineStatus: InvoiceMatchStatus;
      if (discrepancyType === null) {
        lineStatus = InvoiceMatchStatus.MATCHED;
      } else if (withinTolerance) {
        lineStatus = InvoiceMatchStatus.TOLERANCE_APPROVED;
      } else {
        lineStatus = InvoiceMatchStatus.EXCEPTION;
      }

      lineResults.push({
        invoiceLineId: line.id,
        productId: line.productId,
        productName: line.product.name,
        poQuantity: poQty,
        grQuantity: grQty,
        invoiceQuantity: invQty,
        poUnitPrice: poPrice,
        invoiceUnitPrice: invPrice,
        quantityVariancePercent: qtyVariance !== null ? Math.round(qtyVariance * 100) / 100 : null,
        priceVariancePercent: priceVariance !== null ? Math.round(priceVariance * 100) / 100 : null,
        discrepancyType,
        tolerancePercent: tolerance,
        withinTolerance,
        status: lineStatus,
      });
    }

    // Determine overall match status
    const hasExceptions = lineResults.some(r => r.status === InvoiceMatchStatus.EXCEPTION);
    const hasToleranceApprovals = lineResults.some(r => r.status === InvoiceMatchStatus.TOLERANCE_APPROVED);

    let overallStatus: InvoiceMatchStatus;
    if (hasExceptions) {
      overallStatus = InvoiceMatchStatus.EXCEPTION;
    } else if (hasToleranceApprovals) {
      overallStatus = InvoiceMatchStatus.TOLERANCE_APPROVED;
    } else {
      overallStatus = InvoiceMatchStatus.MATCHED;
    }

    // Update the invoice's match status in DB
    await this.prisma.purchaseInvoice.update({
      where: { id: purchaseInvoiceId },
      data: { matchStatus: overallStatus },
    });

    return {
      status: overallStatus,
      lineResults,
      summary: {
        totalLines: lineResults.length,
        matchedLines: lineResults.filter(r => r.status === InvoiceMatchStatus.MATCHED).length,
        toleranceApprovedLines: lineResults.filter(r => r.status === InvoiceMatchStatus.TOLERANCE_APPROVED).length,
        exceptionLines: lineResults.filter(r => r.status === InvoiceMatchStatus.EXCEPTION).length,
      },
    };
  }

  /**
   * Resolve the matching tolerance for a given product.
   * Priority: category-specific config > clinic default config > hardcoded 2% fallback.
   */
  private async getToleranceForProduct(clinicId: string, categoryId: string | null): Promise<number> {
    // Try category-specific tolerance first
    if (categoryId) {
      const config = await this.prisma.matchingToleranceConfig.findFirst({
        where: { clinicId, categoryId, isActive: true },
      });
      if (config) return Number(config.tolerancePercent);
    }

    // Fall back to default clinic tolerance (categoryId = null)
    const defaultConfig = await this.prisma.matchingToleranceConfig.findFirst({
      where: { clinicId, categoryId: null, isActive: true },
    });

    // Hardcoded fallback: 2%
    return defaultConfig ? Number(defaultConfig.tolerancePercent) : 2.0;
  }
}
