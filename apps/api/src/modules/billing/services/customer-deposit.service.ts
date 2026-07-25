import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

@Injectable()
export class CustomerDepositService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  assertSufficientBalance(currentBalanceMinor: number, requiredMinor: number): void {
    if (currentBalanceMinor < requiredMinor) {
      throw new BadRequestException(
        `Insufficient deposit balance. Required: ฿${(requiredMinor / 100).toFixed(2)}, Available: ฿${(currentBalanceMinor / 100).toFixed(2)}.`,
      );
    }
  }

  async topUp(clinicId: string, ownerUserId: string, amountMinor: number, note?: string) {
    if (amountMinor <= 0) throw new BadRequestException('Topup amount must be positive');
    const db = scopedPrisma(this.prisma, clinicId);

    let deposit = await db.customerDeposit.findFirst({ where: { clinicId, ownerUserId } });

    if (!deposit) {
      deposit = await db.customerDeposit.create({
        data: {
          clinicId,
          ownerUserId,
          amountMinor,
          balanceMinor: amountMinor,
          note,
        },
      });
    } else {
      deposit = await db.customerDeposit.update({
        where: { id: deposit.id },
        data: {
          amountMinor: deposit.amountMinor + amountMinor,
          balanceMinor: deposit.balanceMinor + amountMinor,
        },
      });
    }

    await db.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: 'TOPUP',
        amountMinor,
        balanceAfterMinor: deposit.balanceMinor,
      },
    });

    this.events.emit('deposit.created', {
      clinicId,
      depositId: deposit.id,
      ownerUserId,
      amountMinor,
    });

    return deposit;
  }

  async consume(clinicId: string, ownerUserId: string, amountMinor: number, referenceId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const deposit = await db.customerDeposit.findFirst({ where: { clinicId, ownerUserId } });

    if (!deposit) throw new NotFoundException('No deposit wallet found for customer');
    this.assertSufficientBalance(deposit.balanceMinor, amountMinor);

    const updated = await db.customerDeposit.update({
      where: { id: deposit.id },
      data: { balanceMinor: deposit.balanceMinor - amountMinor },
    });

    await db.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: 'CONSUMPTION',
        amountMinor,
        balanceAfterMinor: updated.balanceMinor,
        referenceId,
      },
    });

    return updated;
  }
}
