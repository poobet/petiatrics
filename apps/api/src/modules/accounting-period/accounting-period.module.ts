import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AccountingPeriodService } from './services/accounting-period.service';
import { AccountingPeriodController } from './controllers/accounting-period.controller';

@Module({
  controllers: [AccountingPeriodController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    AccountingPeriodService,
  ],
  exports: [AccountingPeriodService],
})
export class AccountingPeriodModule {}
