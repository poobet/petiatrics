import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateInventoryLocationDto, UpdateInventoryLocationDto } from '../dto/inventory-location.dto';

const DEFAULT_LOCATIONS = [
  { code: 'WH_MAIN', name: 'Main Warehouse', description: 'Central stock storage for branch', isSellable: true, isDefault: true },
  { code: 'STORE_FRONT', name: 'Front Store Display', description: 'Retail shelf display area', isSellable: true, isDefault: false },
  { code: 'DEFECT_BIN', name: 'Defect & Damaged Bin', description: 'Quarantine area for damaged/returned goods', isSellable: false, isDefault: false },
];

@Injectable()
export class InventoryLocationService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(clinicId: string, branchId: string) {
    let locations = await this.prisma.inventoryLocation.findMany({
      where: { clinicId, branchId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { isSellable: 'desc' }, { name: 'asc' }],
    });

    if (locations.length === 0) {
      // Auto-seed default locations for this branch
      for (const loc of DEFAULT_LOCATIONS) {
        try {
          await this.prisma.inventoryLocation.create({
            data: {
              clinicId,
              branchId,
              code: loc.code,
              name: loc.name,
              description: loc.description,
              isSellable: loc.isSellable,
              isDefault: loc.isDefault,
            },
          });
        } catch {
          // Ignore race conditions
        }
      }

      locations = await this.prisma.inventoryLocation.findMany({
        where: { clinicId, branchId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { isSellable: 'desc' }, { name: 'asc' }],
      });
    }

    return locations;
  }

  async create(clinicId: string, branchId: string, dto: CreateInventoryLocationDto) {
    const existing = await this.prisma.inventoryLocation.findUnique({
      where: { clinicId_branchId_code: { clinicId, branchId, code: dto.code } },
    });

    if (existing) {
      throw new BadRequestException(`Location code "${dto.code}" already exists in this branch`);
    }

    if (dto.isDefault) {
      // Unset previous default
      await this.prisma.inventoryLocation.updateMany({
        where: { clinicId, branchId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.inventoryLocation.create({
      data: {
        clinicId,
        branchId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isSellable: dto.isSellable ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(clinicId: string, branchId: string, id: string, dto: UpdateInventoryLocationDto) {
    const existing = await this.prisma.inventoryLocation.findFirst({
      where: { id, clinicId, branchId },
    });

    if (!existing) {
      throw new NotFoundException(`Inventory location ${id} not found`);
    }

    if (dto.isDefault) {
      await this.prisma.inventoryLocation.updateMany({
        where: { clinicId, branchId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.inventoryLocation.update({
      where: { id },
      data: dto,
    });
  }

  async remove(clinicId: string, branchId: string, id: string) {
    const existing = await this.prisma.inventoryLocation.findFirst({
      where: { id, clinicId, branchId },
    });

    if (!existing) {
      throw new NotFoundException(`Inventory location ${id} not found`);
    }

    return this.prisma.inventoryLocation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
