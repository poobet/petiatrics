import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { BusinessPartnerResponse } from '@petiatrics/types';
import { BusinessPartnerType } from '@petiatrics/types';
import { CreateBusinessPartnerDto } from '../dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from '../dto/update-business-partner.dto';
import { ListBusinessPartnersDto } from '../dto/list-business-partners.dto';

function mapBpToResponse(
  bp: Awaited<ReturnType<BusinessPartnerService['findByIdForManagement']>>,
): BusinessPartnerResponse {
  if (!bp) throw new NotFoundException('Business partner not found');
  return {
    id: bp.id,
    clinicId: bp.clinicId,
    type: bp.type as BusinessPartnerType,
    name: bp.name,
    isActive: bp.isActive,
    user: bp.user
      ? {
          id: bp.user.id,
          role: bp.user.role as string as import('@petiatrics/types').Role,
          email: bp.user.email,
          username: bp.user.username,
        }
      : null,
    vet: bp.vetExt
      ? { licenseNumber: bp.vetExt.licenseNumber, whtRate: Number(bp.vetExt.whtRate) }
      : null,
    supplier: bp.suppExt
      ? { taxId: bp.suppExt.taxId, creditTermDays: bp.suppExt.creditTermDays }
      : null,
    createdAt: bp.createdAt.toISOString(),
    updatedAt: bp.updatedAt.toISOString(),
  };
}

const BP_INCLUDE = {
  user: { select: { id: true, role: true, email: true, username: true } },
  vetExt: true,
  suppExt: true,
} as const;

@Injectable()
export class BusinessPartnerService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(clinicId: string, query: ListBusinessPartnersDto, callerIsManager: boolean): Promise<BusinessPartnerResponse[]> {
    const showInactive = callerIsManager && query.includeInactive === true;

    const bps = await this.prisma.businessPartner.findMany({
      where: {
        clinicId,
        ...(showInactive ? {} : { isActive: true }),
        ...(query.type ? { type: query.type as any } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: BP_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return bps.map((bp) => mapBpToResponse(bp as any));
  }

  async findByIdForManagement(id: string, clinicId: string) {
    return this.prisma.businessPartner.findFirst({
      where: { id, clinicId },
      include: BP_INCLUDE,
    });
  }

  async getById(id: string, clinicId: string): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');
    return mapBpToResponse(bp as any);
  }

  async create(clinicId: string, dto: CreateBusinessPartnerDto): Promise<BusinessPartnerResponse> {
    // Validate VET extension requirement
    if (dto.type === BusinessPartnerType.VET && !dto.vet?.licenseNumber) {
      throw new BadRequestException('licenseNumber is required for VET type');
    }
    if (dto.type === BusinessPartnerType.SUPPLIER && !dto.supplier?.taxId) {
      throw new BadRequestException('taxId and creditTermDays are required for SUPPLIER type');
    }

    // Validate license uniqueness
    if (dto.vet?.licenseNumber) {
      const existing = await this.prisma.bpVet.findUnique({
        where: { licenseNumber: dto.vet.licenseNumber },
      });
      if (existing) throw new ConflictException('Vet license number already exists');
    }

    // Validate user linkage
    if (dto.linkUserId) {
      await this.assertUserLinkage(dto.linkUserId, clinicId);
    }

    const bp = await this.prisma.$transaction(async (tx) => {
      const created = await tx.businessPartner.create({
        data: {
          clinicId,
          type: dto.type as any,
          name: dto.name,
        },
        include: BP_INCLUDE,
      });

      if (dto.vet) {
        await tx.bpVet.create({
          data: {
            bpId: created.id,
            licenseNumber: dto.vet.licenseNumber,
            whtRate: dto.vet.whtRate ?? 3.0,
          },
        });
      }

      if (dto.supplier) {
        await tx.bpSupplier.create({
          data: {
            bpId: created.id,
            taxId: dto.supplier.taxId,
            creditTermDays: dto.supplier.creditTermDays,
          },
        });
      }

      if (dto.linkUserId) {
        await tx.user.update({
          where: { id: dto.linkUserId },
          data: { businessPartnerId: created.id },
        });
      }

      return tx.businessPartner.findFirstOrThrow({
        where: { id: created.id },
        include: BP_INCLUDE,
      });
    });

    return mapBpToResponse(bp as any);
  }

  async update(id: string, clinicId: string, dto: UpdateBusinessPartnerDto): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');

    if (dto.linkUserId) {
      await this.assertUserLinkage(dto.linkUserId, clinicId, id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.businessPartner.update({
          where: { id },
          data: { name: dto.name },
        });
      }

      if (dto.vet !== undefined) {
        if (dto.vet === null) {
          await tx.bpVet.deleteMany({ where: { bpId: id } });
        } else {
          await tx.bpVet.upsert({
            where: { bpId: id },
            create: { bpId: id, licenseNumber: dto.vet.licenseNumber, whtRate: dto.vet.whtRate ?? 3.0 },
            update: { licenseNumber: dto.vet.licenseNumber, whtRate: dto.vet.whtRate ?? 3.0 },
          });
        }
      }

      if (dto.supplier !== undefined) {
        if (dto.supplier === null) {
          await tx.bpSupplier.deleteMany({ where: { bpId: id } });
        } else {
          await tx.bpSupplier.upsert({
            where: { bpId: id },
            create: { bpId: id, taxId: dto.supplier.taxId, creditTermDays: dto.supplier.creditTermDays },
            update: { taxId: dto.supplier.taxId, creditTermDays: dto.supplier.creditTermDays },
          });
        }
      }

      if (dto.linkUserId !== undefined) {
        // Unlink previous user if any
        if (bp.user) {
          await tx.user.update({
            where: { id: bp.user.id },
            data: { businessPartnerId: null },
          });
        }
        if (dto.linkUserId !== null) {
          await tx.user.update({
            where: { id: dto.linkUserId },
            data: { businessPartnerId: id },
          });
        }
      }

      return tx.businessPartner.findFirstOrThrow({
        where: { id },
        include: BP_INCLUDE,
      });
    });

    return mapBpToResponse(updated as any);
  }

  async deactivate(id: string, clinicId: string): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');
    if (!bp.isActive) throw new BadRequestException('Business partner is already inactive');

    const updated = await this.prisma.businessPartner.update({
      where: { id },
      data: { isActive: false },
      include: BP_INCLUDE,
    });

    return mapBpToResponse(updated as any);
  }

  private async assertUserLinkage(userId: string, clinicId: string, currentBpId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.clinicId !== clinicId) {
      throw new ForbiddenException('User does not belong to this clinic');
    }
    if (user.businessPartnerId && user.businessPartnerId !== currentBpId) {
      throw new ConflictException('User is already linked to another Business Partner');
    }
  }
}
