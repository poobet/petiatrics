import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface CreateItemCategoryDto {
  code: string;
  name: string;
  revenueGlAccountId?: string;
  expenseGlAccountId?: string;
}

export interface UpdateItemCategoryDto {
  name?: string;
  revenueGlAccountId?: string | null;
  expenseGlAccountId?: string | null;
  isActive?: boolean;
}

@Injectable()
export class ItemCategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find all item categories visible to a clinic (global system defaults + clinic-custom categories)
   * Resolves clinic-specific overrides from ItemCategoryConfig (Copy-on-Write pattern)
   */
  async findAll(clinicId?: string, search?: string) {
    const andConditions: any[] = [{ isActive: true }];

    if (clinicId) {
      andConditions.push({
        OR: [{ clinicId: null }, { clinicId }],
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const [baseCategories, clinicConfigs] = await Promise.all([
      this.prisma.itemCategory.findMany({
        where: { AND: andConditions },
        include: {
          revenueGlAccount: true,
          expenseGlAccount: true,
        },
        orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      }),
      clinicId
        ? this.prisma.itemCategoryConfig.findMany({
            where: { clinicId },
            include: {
              revenueGlAccount: true,
              expenseGlAccount: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // O(1) Map resolution for overrides
    const configMap = new Map(clinicConfigs.map((cfg) => [cfg.itemCategoryId, cfg]));

    return baseCategories.map((cat) => {
      const cfg = configMap.get(cat.id);
      return {
        id: cat.id,
        clinicId: cat.clinicId,
        code: cat.code,
        name: cfg?.customName ?? cat.name,
        revenueGlAccountId: cfg ? cfg.revenueGlAccountId : cat.revenueGlAccountId,
        expenseGlAccountId: cfg ? cfg.expenseGlAccountId : cat.expenseGlAccountId,
        isSystem: cat.isSystem,
        isActive: cat.isActive,
        isOverride: !!cfg,
        revenueGlAccount: cfg ? cfg.revenueGlAccount : cat.revenueGlAccount,
        expenseGlAccount: cfg ? cfg.expenseGlAccount : cat.expenseGlAccount,
      };
    });
  }

  /**
   * Create a new clinic-scoped custom item category
   */
  async create(clinicId: string, dto: CreateItemCategoryDto) {
    const formattedCode = dto.code.toUpperCase().trim().replace(/\s+/g, '_');
    const trimmedName = dto.name.trim();

    // Check code/name conflicts within clinic or system scope
    const existing = await this.prisma.itemCategory.findFirst({
      where: {
        OR: [
          { code: formattedCode, OR: [{ clinicId: null }, { clinicId }] },
          { name: trimmedName, OR: [{ clinicId: null }, { clinicId }] },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(`Item category code "${formattedCode}" or name "${trimmedName}" already exists.`);
    }

    return this.prisma.itemCategory.create({
      data: {
        clinicId,
        code: formattedCode,
        name: trimmedName,
        revenueGlAccountId: dto.revenueGlAccountId || null,
        expenseGlAccountId: dto.expenseGlAccountId || null,
        isSystem: false,
        isActive: true,
      },
      include: {
        revenueGlAccount: true,
        expenseGlAccount: true,
      },
    });
  }

  /**
   * Update an existing item category's label or GL account bindings.
   * - Custom categories (clinic-scoped): updates ItemCategory directly.
   * - System categories (isSystem: true): upserts ItemCategoryConfig override for this clinic (Copy-on-Write).
   */
  async update(clinicId: string, id: string, dto: UpdateItemCategoryDto) {
    const category = await this.prisma.itemCategory.findFirst({
      where: {
        id,
        OR: [{ clinicId: null }, { clinicId }],
      },
    });

    if (!category) {
      throw new NotFoundException(`Item category with ID "${id}" was not found.`);
    }

    // Copy-on-Write pattern: System categories create/update a clinic-specific override config
    if (category.isSystem || category.clinicId === null) {
      const config = await this.prisma.itemCategoryConfig.upsert({
        where: { clinicId_itemCategoryId: { clinicId, itemCategoryId: id } },
        update: {
          ...(dto.name ? { customName: dto.name.trim() } : {}),
          ...(dto.revenueGlAccountId !== undefined ? { revenueGlAccountId: dto.revenueGlAccountId } : {}),
          ...(dto.expenseGlAccountId !== undefined ? { expenseGlAccountId: dto.expenseGlAccountId } : {}),
        },
        create: {
          clinicId,
          itemCategoryId: id,
          customName: dto.name ? dto.name.trim() : category.name,
          revenueGlAccountId: dto.revenueGlAccountId !== undefined ? dto.revenueGlAccountId : category.revenueGlAccountId,
          expenseGlAccountId: dto.expenseGlAccountId !== undefined ? dto.expenseGlAccountId : category.expenseGlAccountId,
        },
        include: {
          revenueGlAccount: true,
          expenseGlAccount: true,
        },
      });

      return {
        id: category.id,
        clinicId: category.clinicId,
        code: category.code,
        name: config.customName ?? category.name,
        revenueGlAccountId: config.revenueGlAccountId,
        expenseGlAccountId: config.expenseGlAccountId,
        isSystem: category.isSystem,
        isActive: category.isActive,
        isOverride: true,
        revenueGlAccount: config.revenueGlAccount,
        expenseGlAccount: config.expenseGlAccount,
      };
    }

    // Direct update for custom clinic-scoped categories
    const updated = await this.prisma.itemCategory.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.revenueGlAccountId !== undefined ? { revenueGlAccountId: dto.revenueGlAccountId } : {}),
        ...(dto.expenseGlAccountId !== undefined ? { expenseGlAccountId: dto.expenseGlAccountId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        revenueGlAccount: true,
        expenseGlAccount: true,
      },
    });

    return {
      ...updated,
      isOverride: false,
    };
  }

  /**
   * Deactivate a clinic-custom item category
   */
  async deactivate(clinicId: string, id: string) {
    const existing = await this.prisma.itemCategory.findFirst({
      where: {
        id,
        OR: [{ clinicId: null }, { clinicId }],
      },
    });

    if (!existing) {
      throw new NotFoundException(`Item category with ID "${id}" was not found.`);
    }

    if (existing.isSystem) {
      throw new ForbiddenException(`System category "${existing.name}" is protected and cannot be deleted.`);
    }

    return this.prisma.itemCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
