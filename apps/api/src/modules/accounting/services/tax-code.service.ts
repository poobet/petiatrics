import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, TaxComputation } from '@prisma/client';

export interface CreateTaxCodePayload {
  clinicId?: string;
  code: string;
  name: string;
  rate: number;
  computationType?: TaxComputation;
  glAccountId?: string;
}

export interface UpdateTaxCodePayload {
  name?: string;
  rate?: number;
  computationType?: TaxComputation;
  glAccountId?: string;
  isActive?: boolean;
}

@Injectable()
export class TaxCodeService {
  constructor(private readonly prisma: PrismaClient) {}

  async getTaxCodes(clinicId?: string) {
    return this.prisma.taxCode.findMany({
      where: {
        isActive: true,
        ...(clinicId ? { OR: [{ clinicId: null }, { clinicId }] } : {}),
      },
      include: {
        glAccount: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async createTaxCode(payload: CreateTaxCodePayload) {
    return this.prisma.taxCode.create({
      data: {
        clinicId: payload.clinicId,
        code: payload.code.trim().toUpperCase(),
        name: payload.name,
        rate: payload.rate,
        computationType: payload.computationType ?? TaxComputation.TAX_INCLUDED,
        glAccountId: payload.glAccountId,
      },
      include: {
        glAccount: true,
      },
    });
  }

  async updateTaxCode(id: string, payload: UpdateTaxCodePayload) {
    const existing = await this.prisma.taxCode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tax code with ID "${id}" was not found.`);
    }

    return this.prisma.taxCode.update({
      where: { id },
      data: {
        name: payload.name,
        rate: payload.rate,
        computationType: payload.computationType,
        glAccountId: payload.glAccountId,
        isActive: payload.isActive,
      },
      include: {
        glAccount: true,
      },
    });
  }
}
