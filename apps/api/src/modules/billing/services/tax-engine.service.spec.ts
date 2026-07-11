import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TaxEngineService, vatTypeToRateBps, VAT_RATES } from './tax-engine.service';
import { DefaultVatType, DispensingCategory } from '@petiatrics/types';

function buildPrismaMock() {
  return {
    product: {
      findUnique: jest.fn(),
    },
  };
}

describe('TaxEngineService', () => {
  let service: TaxEngineService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxEngineService,
        { provide: PrismaClient, useValue: prisma },
      ],
    }).compile();
    service = module.get<TaxEngineService>(TaxEngineService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── vatTypeToRateBps (pure helper) ─────────────────────────────────────────

  describe('vatTypeToRateBps()', () => {
    it('returns 700 for VAT_7', () => {
      expect(vatTypeToRateBps(DefaultVatType.VAT_7)).toBe(700);
    });
    it('returns 0 for VAT_EXEMPT', () => {
      expect(vatTypeToRateBps(DefaultVatType.VAT_EXEMPT)).toBe(0);
    });
    it('returns 0 for NON_VAT', () => {
      expect(vatTypeToRateBps(DefaultVatType.NON_VAT)).toBe(0);
    });
  });

  // ─── resolveVatRateBps ───────────────────────────────────────────────────────

  describe('resolveVatRateBps()', () => {
    it('returns 700 in clinical context regardless of defaultVatType', () => {
      const product = { defaultVatType: DefaultVatType.VAT_EXEMPT };
      expect(service.resolveVatRateBps(product, true)).toBe(700);
    });

    it('returns 700 in clinical context for VAT_7 product', () => {
      const product = { defaultVatType: DefaultVatType.VAT_7 };
      expect(service.resolveVatRateBps(product, true)).toBe(700);
    });

    it('returns 700 in OTC context for VAT_7 product', () => {
      const product = { defaultVatType: DefaultVatType.VAT_7 };
      expect(service.resolveVatRateBps(product, false)).toBe(700);
    });

    it('returns 0 in OTC context for VAT_EXEMPT product', () => {
      const product = { defaultVatType: DefaultVatType.VAT_EXEMPT };
      expect(service.resolveVatRateBps(product, false)).toBe(0);
    });

    it('returns 0 in OTC context for NON_VAT product', () => {
      const product = { defaultVatType: DefaultVatType.NON_VAT };
      expect(service.resolveVatRateBps(product, false)).toBe(0);
    });
  });

  // ─── assertDispensingPermission ─────────────────────────────────────────────

  describe('assertDispensingPermission()', () => {
    const makeProduct = (cat: DispensingCategory) => ({
      id: 'prod-001',
      name: 'Test Drug',
      dispensingCategory: cat,
    });

    it('allows General_Retail in OTC context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.General_Retail), false),
      ).not.toThrow();
    });

    it('allows Household_Remedy in OTC context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Household_Remedy), false),
      ).not.toThrow();
    });

    it('BLOCKS Dangerous_Drug in OTC context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Dangerous_Drug), false),
      ).toThrow(BadRequestException);
    });

    it('ALLOWS Dangerous_Drug in clinical context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Dangerous_Drug), true),
      ).not.toThrow();
    });

    it('BLOCKS Specially_Controlled_Drug in OTC context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Specially_Controlled_Drug), false),
      ).toThrow(BadRequestException);
    });

    it('ALLOWS Specially_Controlled_Drug in clinical context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Specially_Controlled_Drug), true),
      ).not.toThrow();
    });

    it('BLOCKS Clinic_Use_Only in OTC context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Clinic_Use_Only), false),
      ).toThrow(BadRequestException);
    });

    it('ALLOWS Clinic_Use_Only in clinical context', () => {
      expect(() =>
        service.assertDispensingPermission(makeProduct(DispensingCategory.Clinic_Use_Only), true),
      ).not.toThrow();
    });
  });

  // ─── computeLineTax ─────────────────────────────────────────────────────────

  describe('computeLineTax()', () => {
    it('calculates VAT-exclusive line (standard 7%)', () => {
      // 100 THB unit price, qty 2, 7% VAT exclusive
      const result = service.computeLineTax(10_000, 2, 700, false);
      expect(result.subtotalMinor).toBe(20_000); // 200 THB
      expect(result.vatTotalMinor).toBe(1_400);  // 14 THB
      expect(result.totalMinor).toBe(21_400);     // 214 THB
    });

    it('calculates VAT-inclusive line (back-calculates VAT)', () => {
      // Price is 107 THB inclusive of 7% VAT
      // VAT = 107 * 700 / (10000 + 700) = 7 THB
      const result = service.computeLineTax(10_700, 1, 700, true);
      expect(result.vatTotalMinor).toBe(700);  // 7 THB
      expect(result.subtotalMinor).toBe(10_000); // 100 THB
      expect(result.totalMinor).toBe(10_700);   // 107 THB
    });

    it('returns zero VAT for exempt products', () => {
      const result = service.computeLineTax(10_000, 1, 0, false);
      expect(result.vatTotalMinor).toBe(0);
      expect(result.subtotalMinor).toBe(10_000);
      expect(result.totalMinor).toBe(10_000);
    });
  });
});
