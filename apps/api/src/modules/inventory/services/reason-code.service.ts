import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, ReasonCodeType } from '@prisma/client';
import { CreateReasonCodeDto, UpdateReasonCodeDto } from '../dto/reason-code.dto';
import { InventoryLocationService } from './inventory-location.service';

@Injectable()
export class ReasonCodeService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly locationService: InventoryLocationService,
  ) {}

  async findAll(clinicId: string, branchId?: string) {
    let reasonCodes = await this.prisma.reasonCode.findMany({
      where: {
        clinicId,
        isActive: true,
        OR: branchId ? [{ branchId: null }, { branchId }] : undefined,
      },
      include: { defaultLocation: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });

    if (reasonCodes.length === 0 && branchId) {
      // Ensure default locations exist first
      const locations = await this.locationService.findAll(clinicId, branchId);
      const defectLoc = locations.find((l) => !l.isSellable) || locations[0];
      const sellableLoc = locations.find((l) => l.isSellable) || locations[0];

      const defaults = [
        { code: 'RTN_CUSTOMER', description: 'Customer Return (Sellable Good Condition)', type: ReasonCodeType.RETURN, defaultLocationId: sellableLoc?.id },
        { code: 'RTN_DEFECT', description: 'Customer Return (Damaged / Defective)', type: ReasonCodeType.RETURN, defaultLocationId: defectLoc?.id },
        { code: 'EXPIRED_WRITE_OFF', description: 'Expired Item Write-Off', type: ReasonCodeType.EXPIRED, defaultLocationId: defectLoc?.id },
        { code: 'SHRINKAGE', description: 'Inventory Discrepancy / Shrinkage', type: ReasonCodeType.SHRINKAGE, defaultLocationId: sellableLoc?.id },
      ];

      for (const d of defaults) {
        try {
          await this.prisma.reasonCode.create({
            data: {
              clinicId,
              branchId: null,
              code: d.code,
              description: d.description,
              type: d.type,
              defaultLocationId: d.defaultLocationId,
            },
          });
        } catch {
          // Ignore duplicates
        }
      }

      reasonCodes = await this.prisma.reasonCode.findMany({
        where: { clinicId, isActive: true },
        include: { defaultLocation: true },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
      });
    }

    return reasonCodes;
  }

  async create(clinicId: string, dto: CreateReasonCodeDto) {
    const existing = await this.prisma.reasonCode.findUnique({
      where: { clinicId_code: { clinicId, code: dto.code } },
    });

    if (existing) {
      throw new BadRequestException(`Reason code "${dto.code}" already exists in this clinic`);
    }

    return this.prisma.reasonCode.create({
      data: {
        clinicId,
        branchId: dto.branchId || null,
        code: dto.code,
        description: dto.description,
        type: dto.type ?? ReasonCodeType.RETURN,
        defaultLocationId: dto.defaultLocationId || null,
      },
      include: { defaultLocation: true },
    });
  }

  async update(clinicId: string, id: string, dto: UpdateReasonCodeDto) {
    const existing = await this.prisma.reasonCode.findFirst({
      where: { id, clinicId },
    });

    if (!existing) {
      throw new NotFoundException(`Reason code ${id} not found`);
    }

    return this.prisma.reasonCode.update({
      where: { id },
      data: dto,
      include: { defaultLocation: true },
    });
  }

  async remove(clinicId: string, id: string) {
    const existing = await this.prisma.reasonCode.findFirst({
      where: { id, clinicId },
    });

    if (!existing) {
      throw new NotFoundException(`Reason code ${id} not found`);
    }

    return this.prisma.reasonCode.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
