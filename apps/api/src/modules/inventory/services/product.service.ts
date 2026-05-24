import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { ItemType } from '@petiatrics/types';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';

/** Fields to include for every product query — category, unit, taxCode, supplier. */
const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, code: true } },
  baseUnit: { select: { id: true, name: true, symbol: true } },
  defaultTaxCode: { select: { id: true, code: true, rate: true, type: true } },
  defaultSupplier: { select: { id: true, name: true } },
} as const;

/** Extended include that also loads unit conversions. */
const PRODUCT_INCLUDE_DETAIL = {
  ...PRODUCT_INCLUDE,
  unitConversions: {
    include: { unit: { select: { id: true, name: true, symbol: true, isActive: true } } },
  },
} as const;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Normalize item codes: trim whitespace and uppercase. */
  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  // ─── Validation helpers ────────────────────────────────────────────────────

  private async assertCodeUnique(clinicId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: { clinicId, code, id: excludeId ? { not: excludeId } : undefined },
    });
    if (existing) throw new ConflictException(`Item code "${code}" already exists in this clinic.`);
  }

  private async assertCategoryExists(categoryId: string) {
    const cat = await this.prisma.itemCategory.findUnique({ where: { id: categoryId, isActive: true } });
    if (!cat) throw new BadRequestException(`Category "${categoryId}" not found or inactive.`);
  }

  private async assertUnitExists(unitId: string) {
    const unit = await this.prisma.unitOfMeasure.findUnique({ where: { id: unitId, isActive: true } });
    if (!unit) throw new BadRequestException(`Unit of measure "${unitId}" not found or inactive.`);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(clinicId: string, dto: CreateProductDto) {
    const code = this.normalizeCode(dto.code);
    await this.assertCodeUnique(clinicId, code);
    await this.assertCategoryExists(dto.categoryId);
    await this.assertUnitExists(dto.baseUnitId);

    if (dto.defaultTaxCodeId) {
      const tc = await this.prisma.taxCode.findUnique({ where: { id: dto.defaultTaxCodeId } });
      if (!tc) throw new BadRequestException(`Tax code "${dto.defaultTaxCodeId}" not found.`);
    }
    if (dto.defaultSupplierId) {
      const bp = await this.prisma.businessPartner.findFirst({ where: { id: dto.defaultSupplierId, clinicId } });
      if (!bp) throw new BadRequestException(`Supplier "${dto.defaultSupplierId}" not found.`);
    }

    const { conversions, ...rest } = dto;
    const db = scopedPrisma(this.prisma, clinicId);

    return db.product.create({
      data: {
        clinicId,
        ...rest,
        code,
        unitConversions: conversions?.length
          ? { create: conversions.map((c) => ({ unitId: c.unitId, ratioToBase: c.ratioToBase })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE_DETAIL,
    });
  }

  async findAll(clinicId: string, branchId: string, query: ListProductsDto = {}) {
    const db = scopedPrisma(this.prisma, clinicId);
    const { search, itemType, categoryId, includeInactive, controlledSubstance, page = 1, perPage = 50 } = query;

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (itemType) where.itemType = itemType;
    if (categoryId) where.categoryId = categoryId;
    if (controlledSubstance !== undefined) where.isControlledSubstance = controlledSubstance;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * perPage;
    const [total, items, balances] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: [{ name: 'asc' }],
        skip,
        take: perPage,
      }),
      db.branchStockBalance.findMany({
        where: { clinicId, branchId },
        select: { productId: true, quantity: true },
      }),
    ]);

    const byProductId = new Map(balances.map((row) => [row.productId, Number(row.quantity)]));
    const mappedItems = items.map((item) => ({
      ...item,
      quantity: item.itemType === ItemType.SERVICE ? null : (byProductId.get(item.id) ?? 0),
      reorderThreshold: Number(item.reorderThreshold),
    }));

    return { items: mappedItems, total, page, perPage };
  }

  async findById(clinicId: string, id: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE_DETAIL,
    });
    if (!product) throw new NotFoundException(`Item "${id}" not found.`);
    return product;
  }

  async update(clinicId: string, id: string, dto: UpdateProductDto) {
    await this.findById(clinicId, id);

    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    if (dto.baseUnitId) await this.assertUnitExists(dto.baseUnitId);
    if (dto.defaultTaxCodeId) {
      const tc = await this.prisma.taxCode.findUnique({ where: { id: dto.defaultTaxCodeId } });
      if (!tc) throw new BadRequestException(`Tax code "${dto.defaultTaxCodeId}" not found.`);
    }
    if (dto.defaultSupplierId) {
      const bp = await this.prisma.businessPartner.findFirst({ where: { id: dto.defaultSupplierId, clinicId } });
      if (!bp) throw new BadRequestException(`Supplier "${dto.defaultSupplierId}" not found.`);
    }

    const { conversions, ...rest } = dto;
    const db = scopedPrisma(this.prisma, clinicId);

    // Delete and recreate conversions when provided
    if (conversions !== undefined) {
      await this.prisma.itemUnitConversion.deleteMany({ where: { productId: id } });
    }

    return db.product.update({
      where: { id },
      data: {
        ...rest,
        unitConversions: conversions?.length
          ? { create: conversions.map((c) => ({ unitId: c.unitId, ratioToBase: c.ratioToBase })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE_DETAIL,
    });
  }

  async deactivate(clinicId: string, id: string) {
    await this.findById(clinicId, id);
    const db = scopedPrisma(this.prisma, clinicId);
    return db.product.update({ where: { id }, data: { isActive: false }, include: PRODUCT_INCLUDE });
  }

  /** Returns stocked goods with branch quantity \u2264 reorderThreshold (reorderThreshold > 0 only). */
  async getLowStock(clinicId: string, branchId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const balances = await db.branchStockBalance.findMany({
      where: {
        clinicId,
        branchId,
        product: { isActive: true, itemType: ItemType.STOCKED_GOOD },
      },
      include: { product: { include: PRODUCT_INCLUDE } },
    });

    return balances
      .filter(
        (row) =>
          Number(row.product.reorderThreshold) > 0 &&
          Number(row.quantity) <= Number(row.product.reorderThreshold),
      )
      .map((row) => ({
        ...row.product,
        quantity: Number(row.quantity),
        reorderThreshold: Number(row.product.reorderThreshold),
      }));
  }
}
