import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

export interface CreateProductDto {
  name: string;
  sku: string;
  category: string;
  unit: string;
  reorderThreshold?: number;
}

export interface UpdateProductDto {
  name?: string;
  category?: string;
  unit?: string;
  reorderThreshold?: number;
  isActive?: boolean;
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(clinicId: string, dto: CreateProductDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const exists = await db.product.findFirst({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException(`SKU "${dto.sku}" already exists.`);
    return db.product.create({
      data: {
        clinicId,
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        unit: dto.unit,
        reorderThreshold: dto.reorderThreshold ?? 0,
      },
    });
  }

  async findAll(clinicId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(clinicId: string, id: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found.`);
    return product;
  }

  async update(clinicId: string, id: string, dto: UpdateProductDto) {
    await this.findById(clinicId, id);
    const db = scopedPrisma(this.prisma, clinicId);
    return db.product.update({ where: { id }, data: dto as any });
  }

  /** Products with quantity ≤ reorderThreshold */
  async getLowStock(clinicId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const products = await db.product.findMany({
      where: { isActive: true },
    });
    return products.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold),
    );
  }
}
