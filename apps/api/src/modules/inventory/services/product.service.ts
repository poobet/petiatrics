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
import { SkuSequenceService } from './sku-sequence.service';

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
  parentProductAccessories: {
    include: {
      childProduct: {
        select: {
          id: true,
          name: true,
          code: true,
          sku: true,
          itemType: true,
          baseSellingPrice: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly skuSequence: SkuSequenceService,
  ) {}

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

  private async assertBarcodeUnique(barcode: string, excludeId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: { barcode, id: excludeId ? { not: excludeId } : undefined },
    });
    if (existing) throw new ConflictException(`Barcode "${barcode}" is already assigned to another item.`);
  }

  private mapProductResponse(product: any) {
    if (!product) return product;
    const { parentProductAccessories, ...rest } = product;
    const accessories = parentProductAccessories?.map((pa: any) => ({
      childProductId: pa.childProductId,
      name: pa.childProduct?.name,
      code: pa.childProduct?.code,
      sku: pa.childProduct?.sku,
      itemType: pa.childProduct?.itemType,
      baseSellingPrice: pa.childProduct ? Number(pa.childProduct.baseSellingPrice) : undefined,
      quantityRatio: Number(pa.quantityRatio),
    })) ?? [];
    return {
      ...rest,
      accessories,
    };
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
    if (dto.barcode) {
      await this.assertBarcodeUnique(dto.barcode);
    }

    // Auto-assign SKU if not supplied
    const sku = dto.sku ?? (await this.skuSequence.nextSku(clinicId));

    const { conversions, accessories, reorderThreshold, ...rest } = dto;
    const reorderPoint = rest.reorderPoint ?? reorderThreshold;
    const db = scopedPrisma(this.prisma, clinicId);

    const product = await db.product.create({
      data: {
        clinicId,
        ...rest,
        code,
        sku,
        reorderPoint,
        unitConversions: conversions?.length
          ? { create: conversions.map((c) => ({ unitId: c.unitId, ratioToBase: c.ratioToBase })) }
          : undefined,
        parentProductAccessories: accessories?.length
          ? {
              create: accessories.map((a) => ({
                childProductId: a.childProductId,
                quantityRatio: a.quantityRatio,
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE_DETAIL,
    });

    return this.mapProductResponse(product);
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

    const byProductId = new Map<string, number>();
    for (const row of balances) {
      const currentQty = byProductId.get(row.productId) ?? 0;
      byProductId.set(row.productId, currentQty + Number(row.quantity));
    }

    const mappedItems = items.map((item: any) => {
      const mapped = this.mapProductResponse(item);
      return {
        ...mapped,
        quantity: item.itemType === ItemType.SERVICE ? null : (byProductId.get(item.id) ?? 0),
        reorderPoint: Number(item.reorderPoint),
        minimumStock: Number(item.minimumStock),
      };
    });

    return { items: mappedItems, total, page, perPage };
  }

  async findById(clinicId: string, id: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE_DETAIL,
    });
    if (!product) throw new NotFoundException(`Item "${id}" not found.`);
    return this.mapProductResponse(product);
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
    if (dto.barcode !== undefined && dto.barcode !== null) {
      await this.assertBarcodeUnique(dto.barcode, id);
    }

    const { conversions, accessories, reorderThreshold, ...rest } = dto;
    const reorderPoint = rest.reorderPoint ?? reorderThreshold;
    const db = scopedPrisma(this.prisma, clinicId);

    // Delete and recreate conversions when provided
    if (conversions !== undefined) {
      await this.prisma.itemUnitConversion.deleteMany({ where: { productId: id } });
    }

    // Delete and recreate accessories when provided
    if (accessories !== undefined) {
      await this.prisma.productAccessory.deleteMany({ where: { parentProductId: id } });
    }

    const product = await db.product.update({
      where: { id },
      data: {
        ...rest,
        reorderPoint,
        unitConversions: conversions?.length
          ? { create: conversions.map((c) => ({ unitId: c.unitId, ratioToBase: c.ratioToBase })) }
          : undefined,
        parentProductAccessories: accessories?.length
          ? {
              create: accessories.map((a) => ({
                childProductId: a.childProductId,
                quantityRatio: a.quantityRatio,
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE_DETAIL,
    });

    return this.mapProductResponse(product);
  }

  async deactivate(clinicId: string, id: string) {
    await this.findById(clinicId, id);
    const db = scopedPrisma(this.prisma, clinicId);
    return db.product.update({ where: { id }, data: { isActive: false }, include: PRODUCT_INCLUDE });
  }

  async findByBarcode(clinicId: string, barcode: string) {
    const product = await this.prisma.product.findFirst({
      where: { clinicId, barcode, isActive: true },
      include: PRODUCT_INCLUDE_DETAIL,
    });
    if (!product) throw new NotFoundException(`No active item found with barcode "${barcode}".`);
    return this.mapProductResponse(product);
  }

  /** Returns stocked goods with branch quantity \u2264 reorderPoint (reorderPoint > 0 only). */
  async getLowStock(clinicId: string, branchId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const balances = await db.branchStockBalance.findMany({
      where: {
        clinicId,
        branchId,
        product: { isActive: true, itemType: ItemType.INVENTORY },
      },
      include: { product: { include: PRODUCT_INCLUDE } },
    });

    const productMap = new Map<string, { product: any; quantity: number }>();
    for (const row of balances) {
      const prodId = row.productId;
      const qty = Number(row.quantity);
      if (!productMap.has(prodId)) {
        productMap.set(prodId, { product: row.product, quantity: 0 });
      }
      productMap.get(prodId)!.quantity += qty;
    }

    return Array.from(productMap.values())
      .filter(
        ({ product, quantity }) =>
          Number(product.reorderPoint) > 0 &&
          quantity <= Number(product.reorderPoint),
      )
      .map(({ product, quantity }) => ({
        ...product,
        quantity,
        reorderPoint: Number(product.reorderPoint),
        minimumStock: Number(product.minimumStock),
      }));
  }
}
