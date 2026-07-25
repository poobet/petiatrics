import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { TenantId } from '../../../common/decorators/tenant.decorator';
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
  async processPayment(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.processPayment(tenantId || queryClinicId, dto);
  }

  @Get('accounting/trial-balance')
  async getTrialBalance(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
  ) {
    return this.glPostingService.getTrialBalance((tenantId || queryClinicId)!);
  }

  @Post('deposits/topup')
  async topUpDeposit(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
    @Body() dto: { ownerUserId: string; amountMinor: number; note?: string },
  ) {
    return this.depositService.topUp((tenantId || queryClinicId)!, dto.ownerUserId, dto.amountMinor, dto.note);
  }

  @Post('cashier/session/open')
  async openSession(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
    @Body() dto: { cashierUserId: string; openingCashMinor: number },
  ) {
    return this.cashierSessionService.openSession((tenantId || queryClinicId)!, dto.cashierUserId, dto.openingCashMinor);
  }

  @Post('cashier/session/:id/close')
  async closeSession(
    @TenantId() tenantId: string | undefined,
    @Query('clinicId') queryClinicId: string | undefined,
    @Param('id') sessionId: string,
    @Body() dto: { actualCashMinor: number; note?: string },
  ) {
    return this.cashierSessionService.closeSession((tenantId || queryClinicId)!, sessionId, dto.actualCashMinor, dto.note);
  }
}
