import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

@Injectable()
export class CashierSessionService {
  constructor(private readonly prisma: PrismaClient) {}

  calculateDiscrepancy(openingCashMinor: number, systemCashMinor: number, actualCashMinor: number): number {
    const expected = openingCashMinor + systemCashMinor;
    return actualCashMinor - expected;
  }

  async openSession(clinicId: string, cashierUserId: string, openingCashMinor: number) {
    const db = scopedPrisma(this.prisma, clinicId);

    const active = await db.cashierSession.findFirst({
      where: { clinicId, cashierUserId, status: 'OPEN' },
    });
    if (active) throw new BadRequestException('Cashier already has an open session');

    return db.cashierSession.create({
      data: {
        clinicId,
        cashierUserId,
        openingCashMinor,
        systemCashMinor: 0,
        status: 'OPEN',
      },
    });
  }

  async closeSession(clinicId: string, sessionId: string, actualCashMinor: number, note?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const session = await db.cashierSession.findFirst({ where: { id: sessionId, clinicId } });

    if (!session) throw new NotFoundException('Cashier session not found');
    if (session.status === 'CLOSED') throw new BadRequestException('Session is already closed');

    const differenceMinor = this.calculateDiscrepancy(
      session.openingCashMinor,
      session.systemCashMinor,
      actualCashMinor,
    );

    return db.cashierSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        actualCashMinor,
        differenceMinor,
        note,
      },
    });
  }
}
