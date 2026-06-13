import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { ItemType } from '@petiatrics/types';
import { SkuSequenceService } from './sku-sequence.service';

// ─── Row shape from the spreadsheet ─────────────────────────────────────────

interface ImportRow {
  code: string;
  name: string;
  itemType: string;
  categoryCode?: string;
  baseUnitName?: string;
  standardCost?: string;
  baseSellingPrice?: string;
  reorderPoint?: string;
  minimumStock?: string;
  barcode?: string;
  genericName?: string;
  isControlledSubstance?: string;
}

export interface BulkImportResult {
  created: number;
  skipped: number;
  errors: { row: number; code: string; message: string }[];
}

// ─── Accepted column header aliases ─────────────────────────────────────────

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  code: 'code',
  'item code': 'code',
  item_code: 'code',
  name: 'name',
  'item name': 'name',
  item_name: 'name',
  itemtype: 'itemType',
  'item type': 'itemType',
  item_type: 'itemType',
  categorycode: 'categoryCode',
  'category code': 'categoryCode',
  category_code: 'categoryCode',
  category: 'categoryCode',
  baseunitname: 'baseUnitName',
  'base unit': 'baseUnitName',
  base_unit: 'baseUnitName',
  unit: 'baseUnitName',
  standardcost: 'standardCost',
  'standard cost': 'standardCost',
  standard_cost: 'standardCost',
  cost: 'standardCost',
  basesellingprice: 'baseSellingPrice',
  'selling price': 'baseSellingPrice',
  selling_price: 'baseSellingPrice',
  price: 'baseSellingPrice',
  reorderpoint: 'reorderPoint',
  'reorder point': 'reorderPoint',
  reorder_point: 'reorderPoint',
  minimumstock: 'minimumStock',
  'minimum stock': 'minimumStock',
  minimum_stock: 'minimumStock',
  barcode: 'barcode',
  genericname: 'genericName',
  'generic name': 'genericName',
  generic_name: 'genericName',
  iscontrolledsubstance: 'isControlledSubstance',
  'controlled substance': 'isControlledSubstance',
  controlled: 'isControlledSubstance',
};

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly skuSequence: SkuSequenceService,
  ) {}

  // ─── Public entry point ───────────────────────────────────────────────────

  async importFile(
    clinicId: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<BulkImportResult> {
    const rows = this.parse(buffer, mimetype);
    return this.processRows(clinicId, rows);
  }

  // ─── Parsing ─────────────────────────────────────────────────────────────

  private parse(buffer: Buffer, mimetype: string): ImportRow[] {
    const isCsv =
      mimetype === 'text/csv' ||
      mimetype === 'application/csv' ||
      mimetype === 'text/plain';

    if (isCsv) {
      return this.parseCsv(buffer.toString('utf-8'));
    }
    return this.parseXlsx(buffer);
  }

  private parseCsv(text: string): ImportRow[] {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    return result.data.map((row) => this.normalizeRow(row));
  }

  private parseXlsx(buffer: Buffer): ImportRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: '',
      raw: false,
    });
    return raw.map((row) => {
      const lowered: Record<string, string> = {};
      for (const k of Object.keys(row)) lowered[k.trim().toLowerCase()] = String(row[k] ?? '');
      return this.normalizeRow(lowered);
    });
  }

  /** Map arbitrary header strings → canonical ImportRow keys */
  private normalizeRow(raw: Record<string, string>): ImportRow {
    const out: Partial<ImportRow> = {};
    for (const [k, v] of Object.entries(raw)) {
      const mapped = HEADER_ALIASES[k.trim().toLowerCase()];
      if (mapped) (out as Record<string, string>)[mapped] = v.trim();
    }
    return out as ImportRow;
  }

  // ─── Processing ───────────────────────────────────────────────────────────

  private async processRows(clinicId: string, rows: ImportRow[]): Promise<BulkImportResult> {
    if (rows.length === 0) {
      throw new BadRequestException('The file contains no data rows.');
    }
    if (rows.length > 500) {
      throw new BadRequestException('Maximum 500 rows per import.');
    }

    // Pre-load reference data once
    const [categories, units] = await Promise.all([
      this.prisma.itemCategory.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
      this.prisma.unitOfMeasure.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    const catByCode = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const unitByName = new Map(units.map((u) => [u.name.toUpperCase(), u.id]));

    const result: BulkImportResult = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // 1-indexed + header
      const row = rows[i];

      try {
        const created = await this.processRow(clinicId, row, rowNum, catByCode, unitByName);
        if (created) result.created++;
        else result.skipped++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ row: rowNum, code: row.code ?? '(no code)', message });
        this.logger.warn(`Import row ${rowNum} failed: ${message}`);
      }
    }

    return result;
  }

  private async processRow(
    clinicId: string,
    row: ImportRow,
    rowNum: number,
    catByCode: Map<string, string>,
    unitByName: Map<string, string>,
  ): Promise<boolean> {
    if (!row.code) throw new Error(`Row ${rowNum}: "code" is required.`);
    if (!row.name) throw new Error(`Row ${rowNum}: "name" is required.`);

    const code = row.code.trim().toUpperCase();

    // Skip if code already exists in this clinic
    const existing = await this.prisma.product.findFirst({ where: { clinicId, code } });
    if (existing) return false; // skipped

    // Resolve itemType
    const rawType = (row.itemType ?? 'INVENTORY').toUpperCase();
    const itemType: ItemType =
      rawType === 'SERVICE' ? ItemType.SERVICE : ItemType.INVENTORY;

    // Resolve category
    const categoryCode = (row.categoryCode ?? '').toUpperCase();
    const categoryId = catByCode.get(categoryCode);
    if (!categoryId) throw new Error(`Row ${rowNum}: unknown category code "${row.categoryCode}".`);

    // Resolve base unit
    const unitName = (row.baseUnitName ?? '').toUpperCase();
    const baseUnitId = unitByName.get(unitName);
    if (!baseUnitId) throw new Error(`Row ${rowNum}: unknown unit "${row.baseUnitName}".`);

    const sku = await this.skuSequence.nextSku(clinicId);

    await this.prisma.product.create({
      data: {
        clinicId,
        code,
        name: row.name.trim(),
        itemType,
        categoryId,
        baseUnitId,
        sku,
        barcode: row.barcode?.trim() || null,
        genericName: row.genericName?.trim() || null,
        isControlledSubstance: /^(true|yes|1)$/i.test(row.isControlledSubstance ?? ''),
        standardCost: parseFloat(row.standardCost ?? '0') || 0,
        baseSellingPrice: parseFloat(row.baseSellingPrice ?? '0') || 0,
        reorderPoint: itemType === ItemType.INVENTORY ? parseFloat(row.reorderPoint ?? '0') || 0 : 0,
        minimumStock: itemType === ItemType.INVENTORY ? parseFloat(row.minimumStock ?? '0') || 0 : 0,
      },
    });

    return true;
  }
}
