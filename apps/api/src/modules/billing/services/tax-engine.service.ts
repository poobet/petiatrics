import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DefaultVatType, DispensingCategory } from '@petiatrics/types';

/** VAT rate in basis points (bps). 100 bps = 1%, 700 bps = 7%. */
export const VAT_RATES = {
  STANDARD: 700, // Thai standard VAT = 7%
  EXEMPT: 0,
  NON_VAT: 0,
} as const;

/**
 * Maps a product's DefaultVatType to its basis-points VAT rate
 * when in an OTC (non-clinical) context.
 */
export function vatTypeToRateBps(vatType: DefaultVatType): number {
  switch (vatType) {
    case DefaultVatType.VAT_7:
      return VAT_RATES.STANDARD;
    case DefaultVatType.VAT_EXEMPT:
      return VAT_RATES.EXEMPT;
    case DefaultVatType.NON_VAT:
      return VAT_RATES.NON_VAT;
    default:
      return VAT_RATES.STANDARD;
  }
}

export interface ProductTaxProfile {
  id: string;
  name: string;
  defaultVatType: DefaultVatType;
  dispensingCategory: DispensingCategory;
}

export interface TaxedLineItem {
  /** Whether this line was taxed at the clinical rate (true) or product-master OTC rate (false). */
  appliedClinicalVat: boolean;
  vatRateBps: number;
  vatTotalMinor: number;
}

@Injectable()
export class TaxEngineService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolve the VAT rate basis points for a single product line item.
   *
   * Business rules (Thai RD context):
   *  - **Clinical context** (`visitId` present): All products are treated as
   *    veterinary medical services → standard 7% VAT applies regardless of the
   *    product master default.
   *  - **OTC/Retail context** (`visitId` absent): Use the product master's
   *    `defaultVatType` (VAT_7 → 700 bps, VAT_EXEMPT → 0, NON_VAT → 0).
   */
  resolveVatRateBps(product: Pick<ProductTaxProfile, 'defaultVatType'>, isClinicContext: boolean): number {
    if (isClinicContext) {
      // All clinical dispensing is standard-rated per Thai RD guidance
      return VAT_RATES.STANDARD;
    }
    return vatTypeToRateBps(product.defaultVatType);
  }

  /**
   * Validate that a product's dispensing category is permitted in the current sales context.
   * Throws BadRequestException if the sale is not permitted.
   *
   * Thai FDA / Veterinary Profession Act rules:
   *  - `Dangerous_Drug` or `Specially_Controlled_Drug`: ONLY in clinical context (visitId present)
   *  - `Clinic_Use_Only`: NEVER at retail — always requires clinical context
   *  - `General_Retail` / `Household_Remedy`: permitted in both contexts
   */
  assertDispensingPermission(
    product: Pick<ProductTaxProfile, 'id' | 'name' | 'dispensingCategory'>,
    isClinicContext: boolean,
  ): void {
    const { dispensingCategory, name } = product;

    if (
      dispensingCategory === DispensingCategory.Dangerous_Drug ||
      dispensingCategory === DispensingCategory.Specially_Controlled_Drug
    ) {
      if (!isClinicContext) {
        throw new BadRequestException(
          `"${name}" is a controlled substance (${dispensingCategory}) and can only be dispensed in a clinical visit context.`,
        );
      }
    }

    if (dispensingCategory === DispensingCategory.Clinic_Use_Only) {
      if (!isClinicContext) {
        throw new BadRequestException(
          `"${name}" is for clinic use only and cannot be sold at retail.`,
        );
      }
    }
  }

  /**
   * Compute per-line VAT amounts given unit price, quantity, and resolved VAT rate.
   */
  computeLineTax(
    unitPriceMinor: number,
    quantity: number,
    vatRateBps: number,
    isTaxInclusive: boolean,
  ): { subtotalMinor: number; vatTotalMinor: number; totalMinor: number } {
    const grossMinor = Math.round(unitPriceMinor * quantity);

    if (isTaxInclusive) {
      // Back-calculate VAT from inclusive price
      // vatAmount = gross * rate / (10000 + rate)
      const vatTotalMinor = Math.round(grossMinor * vatRateBps / (10_000 + vatRateBps));
      const subtotalMinor = grossMinor - vatTotalMinor;
      return { subtotalMinor, vatTotalMinor, totalMinor: grossMinor };
    } else {
      // VAT added on top
      const subtotalMinor = grossMinor;
      const vatTotalMinor = Math.round(grossMinor * vatRateBps / 10_000);
      return { subtotalMinor, vatTotalMinor, totalMinor: grossMinor + vatTotalMinor };
    }
  }

  /**
   * Look up a product and return its tax/compliance profile.
   * Returns null for SERVICE-type line items (no productId to look up).
   */
  async getProductTaxProfile(productId: string): Promise<ProductTaxProfile | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, defaultVatType: true, dispensingCategory: true },
    });
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      defaultVatType: product.defaultVatType as unknown as DefaultVatType,
      dispensingCategory: product.dispensingCategory as unknown as DispensingCategory,
    };
  }
}
