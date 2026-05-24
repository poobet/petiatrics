import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getItemCategories() {
    return this.prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, revenueGlCode: true, expenseGlCode: true, isActive: true },
    });
  }

  async getUnitsOfMeasure() {
    return this.prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, symbol: true, isActive: true },
    });
  }

  async getTaxCodes() {
    return this.prisma.taxCode.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, description: true, rate: true, isVatType: true, isZeroRated: true, type: true },
    });
  }
}
