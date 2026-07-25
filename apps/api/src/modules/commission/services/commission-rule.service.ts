import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, CommissionType } from '@prisma/client';
import { CreateCommissionRuleDto } from '../dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from '../dto/update-commission-rule.dto';

export interface ResolvedRule {
  commissionType: CommissionType;
  rate: number;
  source: 'ITEM_OVERRIDE' | 'BP_DEFAULT' | 'BP_VET_DEFAULT';
}

@Injectable()
export class CommissionRuleService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(clinicId: string, dto: CreateCommissionRuleDto) {
    const bp = await this.prisma.businessPartner.findFirst({
      where: { id: dto.businessPartnerId, clinicId, isActive: true },
    });
    if (!bp) {
      throw new NotFoundException(`Business partner with ID "${dto.businessPartnerId}" not found`);
    }

    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, clinicId, isActive: true },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
      }
    }

    const existing = await this.prisma.commissionRule.findFirst({
      where: {
        clinicId,
        businessPartnerId: dto.businessPartnerId,
        productId: dto.productId ?? null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `A commission rule for this Business Partner and Product combination already exists`,
      );
    }

    return this.prisma.commissionRule.create({
      data: {
        clinicId,
        businessPartnerId: dto.businessPartnerId,
        productId: dto.productId ?? null,
        commissionType: dto.commissionType,
        rate: dto.rate,
      },
    });
  }

  async findAll(clinicId: string, businessPartnerId?: string) {
    return this.prisma.commissionRule.findMany({
      where: {
        clinicId,
        businessPartnerId: businessPartnerId ? businessPartnerId : undefined,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { id, clinicId },
    });
    if (!rule) {
      throw new NotFoundException(`Commission rule "${id}" not found`);
    }
    return rule;
  }

  async update(clinicId: string, id: string, dto: UpdateCommissionRuleDto) {
    await this.findOne(clinicId, id);
    return this.prisma.commissionRule.update({
      where: { id },
      data: {
        commissionType: dto.commissionType,
        rate: dto.rate,
        isActive: dto.isActive,
      },
    });
  }

  async remove(clinicId: string, id: string) {
    await this.findOne(clinicId, id);
    return this.prisma.commissionRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Resolves commission rule by precedence:
   * 1. CommissionRule where bpId = bp AND productId = item
   * 2. CommissionRule where bpId = bp AND productId = null
   * 3. BpVet.defaultDfRate fallback
   */
  async resolveRule(
    clinicId: string,
    businessPartnerId: string,
    productId?: string,
  ): Promise<ResolvedRule | null> {
    if (productId) {
      const itemRule = await this.prisma.commissionRule.findFirst({
        where: {
          clinicId,
          businessPartnerId,
          productId,
          isActive: true,
        },
      });
      if (itemRule) {
        return {
          commissionType: itemRule.commissionType,
          rate: Number(itemRule.rate),
          source: 'ITEM_OVERRIDE',
        };
      }
    }

    const bpDefaultRule = await this.prisma.commissionRule.findFirst({
      where: {
        clinicId,
        businessPartnerId,
        productId: null,
        isActive: true,
      },
    });
    if (bpDefaultRule) {
      return {
        commissionType: bpDefaultRule.commissionType,
        rate: Number(bpDefaultRule.rate),
        source: 'BP_DEFAULT',
      };
    }

    const bpVet = await this.prisma.bpVet.findUnique({
      where: { bpId: businessPartnerId },
    });
    if (bpVet?.defaultDfRate != null) {
      return {
        commissionType: CommissionType.PERCENTAGE,
        rate: Number(bpVet.defaultDfRate),
        source: 'BP_VET_DEFAULT',
      };
    }

    return null;
  }
}
