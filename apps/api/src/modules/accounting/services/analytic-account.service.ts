import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface CreateAnalyticAccountPayload {
  clinicId: string;
  code: string;
  name: string;
}

@Injectable()
export class AnalyticAccountService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAnalyticAccounts(clinicId: string) {
    return this.prisma.analyticAccount.findMany({
      where: { clinicId },
      orderBy: { code: 'asc' },
    });
  }

  async createAnalyticAccount(payload: CreateAnalyticAccountPayload) {
    return this.prisma.analyticAccount.create({
      data: {
        clinicId: payload.clinicId,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
      },
    });
  }
}
