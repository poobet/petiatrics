import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { PaymentService, CreatePaymentDto } from '../services/payment.service';
import { GLPostingService } from '../services/gl-posting.service';
import { CustomerDepositService } from '../services/customer-deposit.service';
import { CashierSessionService } from '../services/cashier-session.service';

@Controller('billing')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly glPostingService: GLPostingService,
    private readonly depositService: CustomerDepositService,
    private readonly cashierSessionService: CashierSessionService,
  ) {}

  @Post('payments')
  async processPayment(@Query('clinicId') clinicId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.processPayment(clinicId, dto);
  }

  @Get('accounting/trial-balance')
  async getTrialBalance(@Query('clinicId') clinicId: string) {
    return this.glPostingService.getTrialBalance(clinicId);
  }

  @Post('deposits/topup')
  async topUpDeposit(
    @Query('clinicId') clinicId: string,
    @Body() dto: { ownerUserId: string; amountMinor: number; note?: string },
  ) {
    return this.depositService.topUp(clinicId, dto.ownerUserId, dto.amountMinor, dto.note);
  }

  @Post('cashier/session/open')
  async openSession(
    @Query('clinicId') clinicId: string,
    @Body() dto: { cashierUserId: string; openingCashMinor: number },
  ) {
    return this.cashierSessionService.openSession(clinicId, dto.cashierUserId, dto.openingCashMinor);
  }

  @Post('cashier/session/:id/close')
  async closeSession(
    @Query('clinicId') clinicId: string,
    @Param('id') sessionId: string,
    @Body() dto: { actualCashMinor: number; note?: string },
  ) {
    return this.cashierSessionService.closeSession(clinicId, sessionId, dto.actualCashMinor, dto.note);
  }
}
